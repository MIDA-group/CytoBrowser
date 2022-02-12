const fs = require("fs");
const fsPromises = fs.promises;
const diff = require("diff");
const path = require("path");

const maxHistoryEntries = 50; // Set as negative to remove limit


/**
 * A description of a single step in a file's history.
 * @typedef {Object} HistoryEntry
 * @property {number} id Number used to specify the history entry.
 * @property {string} time The time at which the change was made.
 * @property {string} patch A patch from the diff module that can be
 * used to revert the history step.
 * @property {boolean} isRevert Whether or not this step in history
 * was a revert to an earlier step.
 */

/**
 * Information about a single step in a file's history that can be
 * shown to a user.
 * @typedef {Object} HistoryEntryInfo
 * @property {number} id Number used to specify the history entry.
 * @property {string} time The time at which the change was made.
 * @property {boolean} isRevert Whether or not this step in history
 * was a revert to an earlier step.
 * @property {number} nAnnotations Number of annotations (reached after a revert).
 */

/**
 * A description of a file's full recorded history.
 * @typedef {Object} History
 * @property {string} version The version of the history formatting,
 * currently "1.0".
 * @property {number} nextId The id that should be assigned to the next
 * history entry that is added.
 * @property {Array<HistoryEntry>} history A chronological list of
 * history entries.
 */

function getHistoryPath(str) {
    const apart = path.parse(str);
    return path.join(apart.dir,"__HISTORY__"+apart.base);
}

function getExistingHistory(historyPath) {
    return fsPromises.readFile(historyPath, "utf8")
        .then(JSON.parse);
}

function beginNewHistory() {
    return Promise.resolve({
        version: "1.0",
        nextId: 0,
        history: []
    });
}

function getHistory(historyPath) {
    return fsPromises.access(historyPath)
        .then(() => getExistingHistory(historyPath))
        .catch(() => beginNewHistory());
}

function getHistoryInfo(history) {
    return history.history.map(entry => {
        return {
            id: entry.id,
            time: entry.time,
            isRevert: entry.isRevert,
            nAnnotations: entry.nAnnotations
        };
    });
}


/**
 * Add a reverse diff to the history
 * @param {Object} history 
 * @param {string} newData canonical and stringified(null,1) 
 * @param {string} oldData canonical and stringified(null,1), may be null
 * @param {string} filename dummy
 * @param {boolean} isRevert 
 * @return {Object} updated history or null if no change
 */
function extendHistory(history, newData, oldData, filename, isRevert) {
    if (oldData && newData.length == oldData.length) {
        const equal=newData.valueOf() === oldData.valueOf();
        if (equal) { // Typically from reverting twice to the same 
            return false;
        }
    } 

    if (!oldData) { // Create zero annotation data
        let data=JSON.parse(newData);
        data.annotations=[];
        data.nAnnotations=0;
        oldData = JSON.stringify(data, null, 1);
    }

    console.time('diff create patch');
    const revertPatch = diff.createPatch(null, newData, oldData);
    console.timeEnd('diff create patch');
    //console.log(revertPatch);

    const historyEntry = {
        id: history.nextId,
        time: new Date().toISOString(),
        patch: revertPatch,
        isRevert: isRevert,
        nAnnotations: oldData?JSON.parse(oldData).nAnnotations:0
    };
    history.history.push(historyEntry);

    if (maxHistoryEntries >= 0 && history.history.length > maxHistoryEntries) {
        history.history = history.history.slice(history.history.length - maxHistoryEntries);
    }
    history.nextId++;

    return history;
}

/**
 * Iteratively apply revert-patches until reaching versionId
 * @param {string} data Latest saved data to start from (stringified(null,1))
 * @param {Object} history Saved history, to revert from
 * @param {number} versionId How far back to revert
 * @return {string} revertedData
 */
function getOlderVersionOfData(data, history, versionId) {
    console.log('getOld');
    console.log(typeof data);
    const lastEntryIndex = history.history.findIndex(entry => entry.id === versionId);
    if (lastEntryIndex === -1) {
        throw new Error("Tried to revert to a nonexistent history entry");
    }
    let revertedData = data;
    const entries = history.history.slice(lastEntryIndex).reverse();
    console.log(`Initial size: ${revertedData.length}`);
    console.time('diff apply patch');
    entries.forEach(entry => {
        revertedData = diff.applyPatch(revertedData, entry.patch);
        console.log(`Updated size: ${revertedData.length}`);
    });
    console.timeEnd('diff apply patch');
    return revertedData;
}

/**
 * Write data to a given path and add a new entry to the history of
 * the file that can be reverted at a later time.
 * @param {string} path The path to the file.
 * @param {Object} data The data to be stored.
 * @param {boolean} [isRevert=false] Whether or not the history entry
 * corresponding to the file should be marked as the file being reverted.
 */
console.log=console.error;
function writeWithHistory(path, data, isRevert=false) {
    console.log('WriteHist');
    console.log(typeof data);

    console.time('can');
    const canonicalData = diff.canonicalize(data); // Sort keys
    console.timeEnd('can');
    console.time('str');
    const rawData = JSON.stringify(canonicalData, null, 1);
    console.timeEnd('str');
    
    const historyPath = getHistoryPath(path);
    const filename = path.split("/").pop(); //dummy.json?

    return Promise.all([getHistory(historyPath),readLatestVersion(path)])
        .then(([history, oldData]) => extendHistory(history, rawData, oldData, filename, isRevert))
        .then(historyData => {
            if (!historyData) {
                return Promise.resolve(); // No update
            }
            else {
                return Promise.allSettled([
                    fsPromises.writeFile(historyPath, JSON.stringify(historyData)),
                    fsPromises.writeFile(path, rawData)
                ]);
            }
        });
}

/**
 * Read the latest version of a file.
 * @param {string} path The path to the file.
 * @return {Promise<string>} Promise that resolves with the file content.
 */
function readLatestVersion(path) {
    console.log('readlatest');
    return fsPromises.access(path)
        .then(() => fsPromises.readFile(path, "utf8"))
        .catch(() => {
            console.log(`Missing file ${path}`);
            Promise.resolve("{}"); //valid JSON
        });
}

/**
 * Read an older version of a file without writing the revert to storage.
 * @param {string} path The path to the file.
 * @param {number} versionId The id of the version to read.
 * @returns {Promise<string>} Promise that resolves with the file content.
 */
function readOlderVersion(path, versionId) {
    console.log('readOld');
    const historyPath = getHistoryPath(path);
    return Promise.all([getHistory(historyPath),readLatestVersion(path)])
        .then(([history, savedData]) => getOlderVersionOfData(savedData, history, versionId));
}

/**
 * Revert a file to a previous state from its history. Reverting the
 * file will not remove any entries from the history, and will instead
 * be considered as an entry in its history in and of itself.
 * @param {string} path The path to the file.
 * @param {number} id The id of the version to revert to.
 * @return {Promise<>} Promise that resolves when the file has been reverted.
 */
function revertVersion(path, versionId) {
    console.log("================================REVERT=================");
    return readOlderVersion(path, versionId)
        .then(data => writeWithHistory(path, JSON.parse(data), true));
}

/**
 * Get an array of all previous versions for a file at a given path.
 * @param {string} path The path to the file.
 * @returns {Promise<Array<HistoryEntryInfo>>} Info for each previous version.
 */
function getAvailableVersions(path) {
    const historyPath = getHistoryPath(path);
    return getHistory(historyPath)
        .then(history => getHistoryInfo(history));
}

/**
 * Check whether or not a given path leads to a history file.
 * @param {string} path The path to the file.
 * @returns {boolean} Whether or not the file is marked as a history file.
 */
function isHistoryFilename(path) {
    const filename = path.split("/").pop();
    return filename.startsWith("__HISTORY__");
}

module.exports = {
    writeWithHistory: writeWithHistory,
    readLatestVersion: readLatestVersion,
    readOlderVersion: readOlderVersion,
    revertVersion: revertVersion,
    getAvailableVersions: getAvailableVersions,
    isHistoryFilename: isHistoryFilename
};

const fs = require("fs");
const fsPromises = fs.promises;
const path = require("path");
const jsondiffpatch = require('jsondiffpatch'); // Much faster than 'diff'

const maxHistoryEntries = 50; // Set as negative to remove limit


/**
 * A description of a single step in a file's history.
 * @typedef {Object} HistoryEntry
 * @property {number} id Number used to specify the history entry.
 * @property {string} time The time at which the change was made.
 * @property {string} patch A patch from the jsondiffpatch module that 
 * can be used to revert the history step.
 */

/**
 * Information about a single step in a file's history that can be
 * shown to a user.
 * @typedef {Object} HistoryEntryInfo
 * @property {number} id Number used to specify the history entry.
 * @property {string} time The time at which the change was made.
 * @property {number} nAnnotations Number of annotations (reached after a revert).
 */

/**
 * A description of a file's full recorded history.
 * @typedef {Object} History
 * @property {string} version The version of the history formatting,
 * currently "1.1".
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
        version: "1.1",
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
            nAnnotations: entry.nAnnotations
        };
    });
}

// Throw error if false
function assert(condition, message="Assertion failed") {
    if (!condition) {
        throw new Error(message);
    }
}

/**
 * Add a reverse diff to the history
 * @param {Object} history 
 * @param {Object} newData // The currently state
 * @param {Object} oldData // The previous state, or nullish if no prev. state
 * @return {Object} updated history or null if no change
 */
function extendHistory(history, newData, oldData) {
    if (oldData) { //If we have oldData, that means we have existing history
        assert(history.history.length>0,"Corrupt history file");

        const delta = jsondiffpatch.diff(newData, oldData); // Several orders of magnitude faster than 'diff.createPatch'
        if (delta === undefined) { // Equal data; typically from reverting twice to the same 
            //console.info('Equal!');
            return false;
        }
        const revertPatch = JSON.stringify(delta);

        // Update the last entry in the history by suitable patch
        const lastEntry=history.history[history.history.length-1];
        // assert(lastEntry.patch==="{}");
        // assert(lastEntry.nAnnotations===oldData.nAnnotations);
        lastEntry.patch=revertPatch;
    }

    // Entry for the current state
    const newHistoryEntry = {
        id: history.nextId++,
        time: new Date().toISOString(),
        patch: "{}", // Already there = no patch
        nAnnotations: newData.nAnnotations 
    };
    history.history.push(newHistoryEntry);  
   
    if (maxHistoryEntries >= 0 && history.history.length > maxHistoryEntries) {
        history.history = history.history.slice(history.history.length - maxHistoryEntries);
    }

    return history;
}

// For enumerables: objects, arrays, strings
// https://stackoverflow.com/questions/679915/how-do-i-test-for-an-empty-javascript-object
function isEmpty(obj) { for (const i in obj) return false; return true; }

/**
 * Iteratively apply revert-patches until reaching versionId
 * @param {mutated Object} data Latest saved data to start from. OBS in place mutated
 * @param {Object} history Saved history, to revert from
 * @param {number} versionId How far back to revert
 * @return {Object} reverted Data (in place mutated)
 */
function getOlderVersionOfData(data, history, versionId) {
    const lastEntryIndex = history.history.findIndex(entry => entry.id === versionId);
    if (lastEntryIndex === -1) {
        throw new Error("Tried to revert to a nonexistent history entry");
    }
    const entries = history.history.slice(lastEntryIndex).reverse();
    entries.forEach(entry => {
        let patch=JSON.parse(entry.patch);
        if (!isEmpty(patch)) { // patch does not handle '{}' (but uses undefined, which cannot be serialized)
            jsondiffpatch.patch(data, patch);
        }
    });
    return data;
}

/**
 * Write data to a given path and add a new entry to the history of
 * the file that can be reverted at a later time.
 * @param {string} path The path to the file.
 * @param {Object} data The data to be stored.
 * corresponding to the file should be marked as the file being reverted.
 * 
 * Design choice: Possibly we should Canonicalize the saved data (for stable checksumming, diffing etc.)
 *  Currently we stick to the order given by the implementation.
 */
function writeWithHistory(path, data) {
    const historyPath = getHistoryPath(path);
    return Promise.all([getHistory(historyPath),readLatestVersion(path)])
        .then(([history, oldData]) => extendHistory(history, data, oldData))
        .then(historyData => {
            if (!historyData) {
                return Promise.resolve(); // No update
            }
            else {
                return Promise.allSettled([
                    fsPromises.writeFile(historyPath, JSON.stringify(historyData)),
                    fsPromises.writeFile(path, JSON.stringify(data, null, 1)) // Write the main file
                ]);
            }
        });
}

/**
 * Read the latest version of a file.
 * @param {string} path The path to the file.
 * @return {Promise<Object>|undefined} Promise that resolves with the parsed file content.
 */
function readLatestVersion(path) {
    return fsPromises.access(path)
        .then(() => fsPromises.readFile(path, "utf8").then(JSON.parse))
        .catch(() => { // Perfectly normal if no previous version
            //console.log(`Missing file ${path}`); 
        });
}

/**
 * Read an older version of a file without writing the revert to storage.
 * @param {string} path The path to the file.
 * @param {number} versionId The id of the version to read.
 * @returns {Promise<Object>} Promise that resolves with the parsed file content.
 */
function readOlderVersion(path, versionId) {
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
    return readOlderVersion(path, versionId)
        .then(data => writeWithHistory(path, data));
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
    writeWithHistory,
    readLatestVersion,
    revertVersion,
    getAvailableVersions,
    isHistoryFilename
};

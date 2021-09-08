const fs = require("fs");
const fsPromises = fs.promises;
const diff = require("diff");

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


function getHistoryPath(path) {
    const apart = path.split("/");
    const filename = apart.pop();
    const historyFilename = "__HISTORY__" + filename;
    apart.push(historyFilename);
    const together = apart.join("/");
    return together;
}

function getExistingHistory(historyPath) {
    return fsPromises.readFile(historyPath, "utf8").then(JSON.parse);
}

function beginNewHistory() {
    return Promise.resolve({
        version: "1.0",
        nextId: 0,
        history: []
    });
}

function getHistory(path) {
    const historyPath = getHistoryPath(path);
    return fsPromises.access(historyPath)
        .then(() => getExistingHistory(historyPath))
        .catch(() => beginNewHistory());
}

function getHistoryInfo(history) {
    return history.history.map(entry => {
        return {
            id: entry.id,
            time: entry.time,
            isRevert: entry.isRevert
        };
    });
}

function extendHistory(history, data, path, historyPath, isRevert) {
    const filename = path.split("/").pop();
    return fsPromises.readFile(path, "utf8").then(oldData => {
        if (diff.diffJson(JSON.parse(data), JSON.parse(oldData)).length === 1) {
            // Don't save an identical version to history
            return;
        }
        const revertPatch = diff.createPatch(filename, data, oldData);
        const historyEntry = {
            id: history.nextId,
            time: new Date().toISOString(),
            patch: revertPatch,
            isRevert: isRevert
        };
        history.history.push(historyEntry);
        if (maxHistoryEntries >= 0 && history.history.length > maxHistoryEntries) {
            history.history = history.history.slice(history.history.length - maxHistoryEntries);
        }
        history.nextId++;
        const historyData = JSON.stringify(history);
        return fsPromises.writeFile(historyPath, historyData);
    });
}

function writeNewVersion(path, data, isRevert) {
    const historyPath = getHistoryPath(path);
    return getHistory(path)
        .then(history => extendHistory(history, data, path, historyPath, isRevert))
        .then(() => fsPromises.writeFile(path, data));
}

function writeFirstVersion(path, data) {
    return fsPromises.writeFile(path, data);
}

function getOlderVersionOfData(data, history, versionId) {
    const lastEntryIndex = history.history.findIndex(entry => entry.id === versionId);
    if (lastEntryIndex === -1) {
        throw new Error("Tried to revert to a nonexistent history entry");
    }
    let revertedData = data;
    const entries = history.history.slice(lastEntryIndex).reverse();
    entries.forEach(entry => {
        revertedData = diff.applyPatch(revertedData, entry.patch);
    });
    return revertedData;
}

/**
 * Write data to a given path and add a new entry to the history of
 * the file that can be reverted at a later time.
 * @param {string} path The path to the file.
 * @param data The data to write to the file.
 * @param {boolean} [isRevert=false] Whether or not the history entry
 * corresponding to the file should be marked as the file being reverted.
 */
function writeWithHistory(path, data, isRevert=false) {
    return fsPromises.access(path)
        .then(() => writeNewVersion(path, data, isRevert))
        .catch(() => writeFirstVersion(path, data));
}

/**
 * Read the latest version of a file.
 * @param {string} path The path to the file.
 * @return {Promise<>} Promise that resolves with the file content.
 */
function readLatestVersion(path) {
    return fsPromises.readFile(path, "utf8");
}

/**
 * Read an older version of a file without writing the revert to storage.
 * @param {string} path The path to the file.
 * @param {number} versionId The id of the version to read.
 * @returns {Promise<>} Promise that resolves with the file content.
 */
function readOlderVersion(path, versionId) {
    let history;
    const historyPath = getHistoryPath(path);
    return getHistory(path)
        .then(historyData => {
            history = historyData;
            return readLatestVersion(path);
        })
        .then(data => getOlderVersionOfData(data, history, versionId));
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
        .then(data => writeWithHistory(path, data, true));
}

/**
 * Get an array of all previous versions for a file at a given path.
 * @param {string} path The path to the file.
 * @returns {Promise<Array<HistoryEntryInfo>>} Info for each previous version.
 */
function getAvailableVersions(path) {
    const historyPath = getHistoryPath(path);
    return getHistory(path)
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

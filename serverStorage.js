/**
 * @module serverStorage
 * @desc Functions for saving and loading JSON data on the server.
 */

// Declare required modules
const fs = require("fs");
const sanitize = require("sanitize-filename");

// Directory where data should be stored
const dir = "./storage";

// Make sure the directory exists
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
}

/**
 * Encode an object as a JSON file and save it in the storage directory.
 * @param {Object} data The object representation of the data to be stored.
 * @param {string} filename The name of the file to be saved.
 * @returns {Promise<>} A promise that resolves when the save is successful.
 */
function saveJSON(data, filename) {
    if (typeof data !== "object"){
        throw new Error("Stored data should be an Object.");
    }
    filename = sanitize(filename);
    if (!filename) {
        throw new Error("Empty filename.");
    }

    const dataJSON = JSON.stringify(data);
    return new Promise((resolve, reject) => {
        fs.writeFile(`${dir}/${filename}.json`, dataJSON, err => {
            if (err) {
                reject(err);
            }
            else {
                console.info(`Saved file: ${filename}.json`);
                resolve();
            }
        });
    });
}

/**
 * Load an object from a specified JSON file.
 * @param {string} filename The file name to load, with file extension.
 * @returns {Promise<Object>} A promise that resolves with the read data object.
 */
function loadJSON(filename) {
    filename = sanitize(filename);
    if (!filename) {
        throw new Error("Empty filename.");
    }
    return new Promise((resolve, reject) => {
        fs.readFile(`${dir}/${filename}`, (err, data) => {
            if (err) {
                reject(err);
            }
            else {
                const dataObj = JSON.parse(data);
                resolve(dataObj);
            }
        });
    });
}

/**
 * Get a list of the files stored on the server.
 * @returns {Promise<Array<string>>} The promise of an array of file names.
 */
function files() {
    return new Promise((resolve, reject) =>
        fs.readdir(dir, (err, dir) => err ? reject(err) : resolve(dir))
    );
}

exports.saveJSON = saveJSON;
exports.loadJSON = loadJSON;
exports.files = files;

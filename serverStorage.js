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
    fs.writeFile(`${dir}/${filename}.json`, dataJSON, err => {
        err ? console.warn(err) : console.info(`Saved file: ${filename}.json`);
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

exports.saveJSON = saveJSON;
exports.loadJSON = loadJSON;

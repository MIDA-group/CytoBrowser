/**
 * @module serverStorage
 * @desc Functions for saving and loading JSON data on the server.
 */

// Declare required modules
const fs = require("fs");
const sanitize = require("sanitize-filename");

// Symbolic references
const duplicateFile = Symbol("Duplicate file");

// Directory where data should be stored
const dir = "./storage";

// Make sure the directory exists
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
}

/**
 * Encode an object as a JSON file and save it in the storage directory.
 * Filenames and paths are sanitized for security reasons. Each segment
 * of the path is treated as a separate filename and sanitized, and
 * filenames are prevented from having any period characters unless
 * directly followed by "json" and an end of string. Sanitation is done
 * with the node module {@link https://www.npmjs.com/package/sanitize-filename|sanitize-filename}
 * @param {Object} data The object representation of the data to be stored.
 * @param {string} filename The name of the file to be saved.
 * @param {string} path The path where the file should be saved, relative
 * do the root of the storage directory.
 * @param {boolean} overwrite If a file with the same name exists, overwrite.
 * @returns {Promise<>} A promise that resolves when the save is successful.
 */
function saveJSON(data, filename, path, overwrite) {
    if (typeof data !== "object"){
        throw new Error("Stored data should be an Object.");
    }
    // Clean up the path and filename
    filename = sanitize(filename);
    let dirs = path.split("/");
    dirs = dirs.map(dir => sanitize(`/${dir}/`)).filter(dir => dir);
    path = dirs.length ? dirs.join("/") + "/" : "";

    // Check if the filename is valid
    if (!filename || !/^[^\.]+\.json$/.test(filename)) {
        throw new Error("Invalid filename.");
    }
    // Check if the path is valid
    if (path) {
        if (/\./.test(path) || !fs.existsSync(`${dir}/${path}`)){
            throw new Error("Invalid path.");
        }
    }
    if (!overwrite) {
        if (fs.existsSync(`${dir}/${path}${filename}`)){
            throw duplicateFile;
        }
    }

    const dataJSON = JSON.stringify(data);
    return new Promise((resolve, reject) => {
        fs.writeFile(`${dir}/${path}${filename}`, dataJSON, err => {
            if (err) {
                reject(err);
            }
            else {
                console.info(`Saved file: ${path}${filename}`);
                resolve();
            }
        });
    });
}

/**
 * Load an object from a specified JSON file.
 * @param {string} filename The file name to load.
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
 * Representation of either a file or a directory in a directory structure.
 * @typedef FileEntry
 * @property {string} name The name of the entry.
 * @property {string} type The type of the entry, either "file" or "directory".
 * @property {Array<FileEntry>} [content] The content, if directory.
 */

/**
 * Get a tree of the files stored in the storage directory.
 * @returns {Promise<Array<FileEntry>>} The promise of an array of file
 * structure entries.
 */
function files() {
    // Function for recursing through the directory tree
    function expand(path) {
        return new Promise((resolve, reject) => {
            fs.readdir(path, {withFileTypes: true}, (err, dir) => {
                if (err) {
                    reject(err);
                }
                // Promises that need to resolve in each subdirectory
                const promises = [];
                const tree = dir.filter(file => file.isDirectory() || file.isFile())
                .map(file => {
                    const entry = {
                        name: file.name,
                        type: file.isDirectory() ? "directory" : "file"
                    };
                    if (entry.type === "directory") {
                        const expansion = expand(`${path}/${entry.name}`);
                        promises.push(expansion);
                        expansion.then(subtree => entry.content = subtree);
                    }
                    return entry;
                });
                // Wait for all subdirectories to expand
                Promise.all(promises).then(() => resolve(tree));
            });
        });
    }

    return expand(dir);
}

exports.duplicateFile = duplicateFile;
exports.saveJSON = saveJSON;
exports.loadJSON = loadJSON;
exports.files = files;

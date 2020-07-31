/**
 * @module serverStorage
 * @desc Functions for saving and loading JSON data on the server.
 */

// Declare required modules
const fs = require("fs");
const fsPromises = fs.promises;
const sanitize = require("sanitize-filename");

// Symbolic references
const duplicateFile = Symbol("Duplicate file");

// Directory where data should be stored
const dir = "./storage";

// Regex for checking if something is an older version
const versionFilter = new RegExp(/__version_\d+__/);

// Make sure the directory exists
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
}

function findVersions(fullPath) {
    const location = fullPath.match(/^.+\//)[0];
    const filename = fullPath.match(/[^\/]+$/)[0];
    // Should make the filename good for regex, according to SO
    const regexFilename = filename.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

    return fsPromises.readdir(location).then(dir => {
        const versionInfo = [];
        const versions = dir.filter(name =>
            name.match(new RegExp(`^__version_\\d__${regexFilename}$`))
        );

        const statPromises = versions.map(version =>
            fsPromises.stat(`${location}${version}`).then(stats => {
                versionInfo.push({
                    number: Number(version.match(/(?<=__version_)\d+(?=__)/)[0]),
                    mtime: stats.mtime
                });
            })
        );

        return Promise.all(statPromises).then(() => versionInfo);
    });
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
 * @param {boolean} reversion If a file with the same name exists, add a
 * new version of the file.
 * @returns {Promise<>} A promise that resolves when the save is successful.
 */
function saveJSON(data, filename, path, overwrite, reversion) {
    if (typeof data !== "object"){
        throw new Error("Stored data should be an Object.");
    }
    if (overwrite && reversion) {
        throw new Error("Either overwrite or reversion, not both.");
    }

    // Clean up the path and filename
    filename = sanitize(filename);
    let dirs = path.split("/");
    dirs = dirs.map(dir => sanitize(`/${dir}/`)).filter(dir => dir);
    path = dirs.length ? dirs.join("/") + "/" : "";

    // Check if the filename is valid
    if (!filename // Filename can't be empty
        || !/^[^\.]+\.json$/.test(filename) // Must be JSON file
        || versionFilter.test(filename)) { // Can't specify version on its own
        throw new Error("Invalid filename.");
    }

    // Check if the path is valid
    if (path) {
        if (/\./.test(path) || !fs.existsSync(`${dir}/${path}`)){
            throw new Error("Invalid path.");
        }
    }

    const fullPath = `${dir}/${path}${filename}`;
    function writeFile() {
        const dataJSON = JSON.stringify(data);
        return fsPromises.writeFile(fullPath, dataJSON)
        .then(() => console.info(`Saved file: ${fullPath}`));
    }

    // Check if the file already exists
    if (!overwrite) {
        if (fs.existsSync(fullPath)){
            if (reversion) {
                return findVersions(fullPath).then(versions => {
                    const versionNumbers = versions.map(version => version.number);
                    const version = versions.length ? Math.max(...versionNumbers) + 1 : 1;
                    const versionPath = `${dir}/${path}__version_${version}__${filename}`;
                    return fsPromises.rename(fullPath, versionPath)
                    .then(writeFile);
                });
            }
            else {
                throw duplicateFile;
            }
        }
    }
    return writeFile();
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
    const fullPath = `${dir}/${filename}`;
    return fsPromises.readFile(fullPath).then(JSON.parse);
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
        return fsPromises.readdir(path, {withFileTypes: true}).then(dir => {
            // Promises that need to resolve in each subdirectory
            const expansionPromises = [];
            const statPromises = [];
            const versionPromises = [];
            const promises = [expansionPromises, statPromises, versionPromises];

            // Add entries for each file and directory
            const tree = dir.filter(file => file.isDirectory() || file.isFile())
            .filter(file => !versionFilter.test(file.name))
            .map(file => {
                const entry = {
                    name: file.name,
                    type: file.isDirectory() ? "directory" : "file"
                };

                const fullPath = `${path}/${entry.name}`;

                // Promise for file stats
                statPromises.push(
                    fsPromises.stat(fullPath)
                    .then(stats => entry.mtime = stats.mtime)
                );

                // Promise for versions
                versionPromises.push(
                    findVersions(fullPath)
                    .then(versions => {
                        if (versions.length) {
                            entry.versions = versions;
                        }
                    })
                );

                // Expand further if directory
                if (entry.type === "directory") {
                    const expansion = expand(`${path}/${entry.name}`);
                    expansionPromises.push(expansion);
                    expansion.then(subtree => entry.content = subtree);
                }
                return entry;
            });

            // Wait for all subdirectories to expand
            return Promise.all(promises.flat()).then(() => tree);
        });
    }

    return expand(dir);
}

exports.duplicateFile = duplicateFile;
exports.saveJSON = saveJSON;
exports.loadJSON = loadJSON;
exports.files = files;

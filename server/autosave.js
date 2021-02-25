/**
 * @module autosave
 * @desc Module used to help with the autosave functionality of the
 * collaborations. Automatically sets and gets filenames for saves
 * based on the collaboration id and image, and stores it in the proper
 * location. Could potentially also be used for general storage of
 * objects with some other associated id and image.
 */

const fs = require("fs");
const fsPromises = fs.promises;
const sanitize = require("sanitize-filename");

let autosaveDir;

function getSubDirName(id, image) {
    const sanitizedImage = sanitize(String(image));
    return sanitizedImage;
}

function getFilename(id, image) {
    const sanitizedId = sanitize(String(id));
    const sanitizedImage = sanitize(String(image));
    return `${sanitizedImage}_${sanitizedId}`;
}

/**
 * Load data from the autosave file structure.
 * @param {string} id The id of the collaboration.
 * @param {string} image The name of the image being saved.
 * @returns {Promise} Promise that resolves with the parsed data.
 */
function loadAnnotations(id, image) {
    const subDir = getSubDirName(id, image);
    const filename = getFilename(id, image);
    const path = `${autosaveDir}/${subDir}/${filename}.json`;
    return fsPromises.readFile(path).then(JSON.parse);
}

/**
 * Save data in the autosave file structure.
 * @param {string} id The id of the collaboration.
 * @param {string} image The name of the image being saved.
 * @param {Object} data The data to be stored.
 * @returns {Promise} Promise that resolves once the data is stored.
 */
function saveAnnotations(id, image, data) {
    const subDir = getSubDirName(id, image);
    const filename = getFilename(id, image);
    const dir = `${autosaveDir}/${subDir}`;
    const path = `${autosaveDir}/${subDir}/${filename}.json`;
    const rawData = JSON.stringify(data);
    return fsPromises.mkdir(dir, {recursive: true}).then(() => {
        return fsPromises.writeFile(path, rawData);
    });
}

module.exports = function(dir) {
    if (!dir) {
        throw new Error("No autosave directory specified!");
    }
    autosaveDir = dir;
    fs.mkdirSync(autosaveDir, {recursive: true});
    return {
        loadAnnotations: loadAnnotations,
        saveAnnotations: saveAnnotations
    };
}

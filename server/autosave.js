const fs = require("fs");
const fsPromises = fs.promises;
const sanitize = require("sanitize-filename");

let autosaveDir;

function getFilename(id, image) {
    const sanitizedId = sanitize(id);
    const sanitizedImage = sanitize(image);
    return `${sanitizedId}_${sanitizedImage}`;
}

function loadAnnotations(id, image) {
    const filename = getFilename(id, image);
    const path = `${autosaveDir}/${filename}.json`;
    return fsPromises.readFile(path).then(JSON.parse);
}

function saveAnnotations(id, image, data) {
    const filename = getFilename(id, image);
    const path = `${autosaveDir}/${filename}.json`;
    const rawData = JSON.stringify(data);
    return fsPromises.writeFile(path, rawData);
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

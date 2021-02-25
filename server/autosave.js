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

function loadAnnotations(id, image) {
    const subDir = getSubDirName(id, image);
    const filename = getFilename(id, image);
    const path = `${autosaveDir}/${subDir}/${filename}.json`;
    return fsPromises.readFile(path).then(JSON.parse);
}

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

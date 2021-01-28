/**
 * @module predictions
 * @desc Used for interfacing with the predictions made by the algorithm
 * through the server in various ways.
 */

const fs = require("fs");
const fsPromises = fs.promises;
let predDir;

function readJsonFromFile(path) {
    return fsPromises.readFile(path).then(data => {
        return JSON.parse(data);
    });
}

function get(image) {
    const name = `${image}.json`;
    return fsPromises.readdir(predDir, {withFileTypes: true}).then(dir => {
        const predFile = dir.find(file =>
            file.isFile() && file.name === name
        );
        if (predFile !== undefined) {
            return readJsonFromFile(`${predDir}/${predFile.name}`);
        }
        else {
            throw new Error("No predictions for the given image exist.");
        }
    });
}

module.exports = function(dir) {
    if (!dir || typeof dir !== "string") {
        throw new Error("A prediction data directory has to be specified.");
    }
    predDir = dir;
    return {
        get: get
    };
}

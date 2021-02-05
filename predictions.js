/**
 * @module predictions
 * @desc Used for interfacing with the predictions made by the algorithm
 * through the server in various ways.
 */

const fs = require("fs");
const fsPromises = fs.promises;
const convertPredictions = require("./convertPredictions");
let predDir;

function readJsonFromFile(path) {
    return fsPromises.readFile(path).then(data => {
        return JSON.parse(data);
    });
}

/**
 * Fill the specified prediction directory with results from the algorithm.
 * This assumes that the results have already been produced.
 * @param {Array<string>} images The names of all images for which
 * results should be prepared.
 * @param {string} zDir The directory where the algorithm has stored the
 * focus-selected image patches.
 * @param {string} csvDir The directory with CSV results
 * @returns {Promise} Promise that resolves once the preparation is done.
 */
function prepare(images, zDir, csvDir) {
    const promises = [];
    images.forEach(image => {
        const p = convertPredictions.convertResultsToObject(image, zDir, csvDir)
            .then(predictions => {
                const filename = `${predDir}/${image}.json`;
                const data = JSON.stringify(predictions);
                fsPromises.writeFile(filename, data);
            });
        promises.push(p);
    });
    return Promise.all(promises);
}

/**
 * Get the predictions for a specified image. The prediction data should
 * already have been generated with `prepare`.
 * @param {string} image The name of the image.
 * @returns {Promise<Object>} The promise of an object with prediction
 * data that can be sent to the client.
 */
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
            throw new Error(`No predictions for the image '${image}' exist.`);
        }
    });
}

module.exports = function(dir) {
    if (!dir || typeof dir !== "string") {
        throw new Error("A prediction data directory has to be specified.");
    }
    predDir = dir;
    return {
        prepare: prepare,
        get: get
    };
}

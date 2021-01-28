/**
 * @module predictions
 * @desc Used for interfacing with the predictions made by the algorithm
 * through the server in various ways.
 */

const fs = require("fs");
const fsPromises = fs.promises;
let predDir;

// Not as much to send if we don't repeat keys for each prediction
// TODO: Should use real data!
const dummyData = {
    id: [0, 1, 2],
    x: [50000, 51000, 49000],
    y: [49000, 50000, 50000],
    z: [0, 0, 0],
    certainty: [0.95, 0.7, 0.8],
    mclass: ["NILM", "ASC-H", "SCC"]
};

function get(image) {
    const name = `${image}.json`;
    return fsPromises.readdir(predDir, {withFileTypes: true}).then(dir => {
        const predFile = dir.find(file =>
            file.isFile() && file.name === name
        );
        if (predFile !== undefined) {
            return dummyData;
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

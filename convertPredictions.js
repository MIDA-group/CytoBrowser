/** convertPredictions
 * @module convertPredictions
 * @desc Used for converting the predictions generated by the model to
 * a format that can be used in CytoBrowser.
 */

const fs = require("fs");
const fsPromises = fs.promises;
const parse = require("csv-parse/lib/sync");

// TODO: Should be able to set these
const WIDTH = 10;
const HEIGHT = 10;

// Some info can be parsed from the filename itself
function parseImageInfo(filenames) {
    const indexFinder = /i\d+j\d+/;
    const iFinder = /(?<=i)\d+/;
    const jFinder = /(?<=j)\d+/;
    const entries = filenames.map(fn => {
        const index = fn.match(indexFinder)[0];
        const i = Number(index.match(iFinder)[0]);
        const j = Number(index.match(jFinder)[0]);
        return {i: i, j: j, filename: fn};
    });
    return entries.sort((a, b) => a.i < b.i || a.j - b.j);
}

function readPredictions(name, dir) {
    return fsPromises.readdir(dir).then(content => {
        const fns = content.filter(n => {
            return n.startsWith(name) && n.endsWith(".csv")
        });
        const entries = parseImageInfo(fns);
        entries.forEach(entry => {
            entry.path = `${dir}/${entry.filename}`;
            const csvData = fs.readFileSync(entry.path);
            entry.data = parse(csvData, {columns: true});
        });
        return entries;
    });
}

function csvDataEntriesToArray(entries) {
    const output = {id: [], x: [], y: []};
    entries.forEach(entry => {
        const offsetX = entry.j * WIDTH;
        const offsetY = entry.i * HEIGHT;
        entry.data.forEach(prediction => {
            output.id.push(output.id.length);
            output.x.push(Number(prediction["X"]) + offsetX);
            output.y.push(Number(prediction["Y"]) + offsetY);
        });
    });
    return output;
}

function convertResultsToObject(name, dir) {
    return readPredictions(name, dir).then(csvDataEntriesToArray);
}

function writeResultsAsJson() {
    const name = "foo";
    const dir = "./csvresults";
    const outputDir = "./predictions";
    convertResultsToObject(name, dir).then(results =>
        fsPromises.writeFile(`${name}.json`, JSON.stringify(results))
    );
}

exports.parseImageInfo = parseImageInfo;
exports.readPredictions = readPredictions;
exports.convertResultsToObject = convertResultsToObject;
exports.writeResultsAsJson = writeResultsAsJson;

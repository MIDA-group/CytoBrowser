/**
 * @module metadata
 * @desc Module for handling metadata on the server. This module both
 * contains logic for the server's handling of metadata and for preparation
 * of abridged JSON-formatted metadata from OME-XML files. This second
 * functionality can be used by calling the module itself as the point
 * of entry.
 */

const fs = require("fs");
const path = require('path');
const {XMLParser} = require('fast-xml-parser');

const metadataCache = {};
const metadataExpirationTime = 60000; // Let the cache expire after 30s
let jsonDir;

function xmlToObject(xmlData) {
    const options = {
        attributeNamePrefix: "@_",
        ignoreAttributes: false,
        allowBooleanAttributes: true,
        parseAttributeValue: true
    };
    const parser = new XMLParser(options);
    return parser.parse(xmlData);
}

function extractImportantMetadata(jsonData) {
    let imageData = jsonData["OME"]["Image"];
    if (Array.isArray(imageData)) {
        imageData = imageData.find(im => im["@_ID"] === "Image:0");
    }
    const importantMetadata = {
        MicroscopeModel: jsonData["OME"]["Instrument"] && jsonData["OME"]["Instrument"]["Microscope"] && jsonData["OME"]["Instrument"]["Microscope"]["@_Model"],
        NominalMagnification: jsonData["OME"]["Instrument"] && jsonData["OME"]["Instrument"]["Objective"] && jsonData["OME"]["Instrument"]["Objective"]["@_NominalMagnification"],
        AcquisitionDate: imageData["AcquisitionDate"],
        PhysicalSizeX: imageData["Pixels"]["@_PhysicalSizeX"],
        PhysicalSizeY: imageData["Pixels"]["@_PhysicalSizeY"],
        PhysicalSizeXUnit: imageData["Pixels"]["@_PhysicalSizeXUnit"],
        PhysicalSizeYUnit: imageData["Pixels"]["@_PhysicalSizeYUnit"],
        SignificantBits: imageData["Pixels"]["@_SignificantBits"],
        SizeC: imageData["Pixels"]["@_SizeC"],
        SizeX: imageData["Pixels"]["@_SizeX"],
        SizeY: imageData["Pixels"]["@_SizeY"],
        SizeZ: imageData["Pixels"]["@_SizeZ"],
    };
    return importantMetadata;
}

/**
 * Get important metadata that corresponds to a specified image.
 * @param {string} imageName The name of the image.
 * @returns {Object} Relevant metadata for the image.
 */
function getMetadataForImage(imageName) {
    if (metadataCache[imageName]) {
        return metadataCache[imageName];
    }
    else {
        const filename = `${jsonDir}/${imageName}.json`;
        try {
            const data = JSON.parse(fs.readFileSync(filename));
            console.log(`Loading metadata from ${filename}`);
            metadataCache[imageName] = data;
            setTimeout(() =>
                delete metadataCache[imageName],
                metadataExpirationTime
            );
            return data;
        }
        catch (e) {
            if (e.code === "ENOENT") {
                console.log(`No metadata file: ${filename}`);
                return {};
            }
            else {
                console.log(`Failed reading metadata file: ${filename}\n- ${e}`);
                return {};
            }
        }
    }
}

function main() {
    const argv = require("minimist")(process.argv.slice(2));
    if (argv.h || argv.help || argv._.length < 2) {
        console.info("Usage: node metadata.js ome.xml-file(s) output-json-dir");
        return;
    }
    else {
        const outputDir = argv._.at(-1);
        const inputFilenames = argv._.slice(0, -1);
        inputFilenames.forEach(fn => {
            const outputFilename = path.basename(fn, '.ome.xml')+'.json';
            const outputPath = `${outputDir}/${outputFilename}`;
            const xmlData = fs.readFileSync(fn, "utf8");
            const data = xmlToObject(xmlData);
            const importantData = extractImportantMetadata(data);
            fs.writeFileSync(outputPath, JSON.stringify(importantData, null, 4));
        });
    }
}

module.exports = function(dir) {
    jsonDir = dir;
    return {
        getMetadataForImage: getMetadataForImage
    }
};

if (require.main === module) {
    main();
}

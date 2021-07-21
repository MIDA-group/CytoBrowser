const fs = require("fs");
const parser = require("fast-xml-parser");


const metadataCache = {};
let jsonDir;

function xmlToObject(xmlData) {
    const options = {
        attributeNamePrefix: "@_",
        ignoreAttributes: false,
        allowBooleanAttributes: true,
        parseAttributeValue: true
    };
    return parser.parse(xmlData, options);
}

function extractImportantMetadata(jsonData) {
    const imageData = jsonData["OME"]["Image"].find(im => im["@_ID"] === "Image:0");
    const importantMetadata = {
        MicroscopeModel: jsonData["OME"]["Instrument"]["Microscope"]["@_Model"],
        NominalMagnification: jsonData["OME"]["Instrument"]["Objective"]["@_NominalMagnification"],
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
    const adjustedImageName = imageName.slice(0, -4);
    if (metadataCache[adjustedImageName]) {
        return metadataCache[adjustedImageName];
    }
    else {
        const filename = `${adjustedImageName}.json`;
        const data = JSON.parse(fs.readFileSync(`${jsonDir}/${filename}`));
        metadataCache[adjustedImageName] = data;
        return data;
    }
}

function main() {
    const inputDir = process.argv[2];
    const outputDir = process.argv[3];
    const inputFilenames = fs.readdirSync(inputDir).filter(fn => fn.endsWith(".ome.xml"));
    inputFilenames.forEach(fn => {
        const path = `${inputDir}/${fn}`;
        const outputFilename = `${fn.slice(0, -8)}.json`;
        const outputPath = `${outputDir}/${outputFilename}`;
        const xmlData = fs.readFileSync(path, "utf8");
        const data = xmlToObject(xmlData);
        const importantData = extractImportantMetadata(data);
        fs.writeFileSync(outputPath, JSON.stringify(importantData, null, 4));
    });
}

module.exports = function() {
    return {
        getMetadataForImage: getMetadataForImage
    }
};

if (require.main === module) {
    main();
}

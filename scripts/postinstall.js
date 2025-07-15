/**
 * Postinstall script that runs after packages have been installed 
 * with npm. This script sets up any additional steps necessary in
 * the package setup process of CytoBrowser. 
 */

const fs = require("fs");
const path = require("path");

// Copy OSD into public
const srcOSDDir = path.resolve(__dirname, "../node_modules/openseadragon/build/openseadragon")
const srcOSDFile = path.resolve(srcOSDDir, "openseadragon.min.js");
const srcOSDImagesDir = path.resolve(srcOSDDir, "images");

const destOSDDir = path.resolve(__dirname, "../public/js/openseadragon");
const destOSDFile = path.resolve(destOSDDir, "openseadragon.min.js");
const destOSDImagesDir = path.resolve(destOSDDir, "images");

try {
    fs.copyFileSync(srcOSDFile, destOSDFile);
    if (!fs.existsSync(destOSDImagesDir)) {
        fs.mkdirSync(destOSDImagesDir);
    }
    const images = fs.readdirSync(srcOSDImagesDir, {withFileTypes: true});
    for (const image of images) {
        const srcFile = path.join(srcOSDImagesDir, image.name);
        const destFile = path.join(destOSDImagesDir, image.name);
        fs.copyFileSync(srcFile, destFile);
    }
    console.log("Successful npm install and setup.");
} catch(err) {
    console.error("Error in npm postinstall script:", err.message);
    process.exit(1);
}
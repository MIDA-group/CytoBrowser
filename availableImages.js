// Declare required modules
const fs = require("fs");

// Variables to avoid having to figure out which images exist every call
const checkInterval = 60000;
let lastCheck = null;

// Variable to cache the available images
let availableImages = null;

// Regex expression for finding dzi files without z values
const nameEx = /.+(?=_z[0-9]+\.dzi)/g;

function getAvailableImages() {
    // Update the available images if enough time has passed
    if (lastCheck === null || Date.now() - checkInterval > lastCheck) {
        fs.readdir('./data', (err, dir) => {
            if (err) {
                availableImages = null;
            }
            else {
                // Find all unique image names in the directory
                let names = dir.map((name) => name.match(nameEx)).flat();
                names = names.filter((name) => name !== null);
                const uniqueNames = [... new Set(names)];

                // TODO: Include information about z values and thumbnails
                availableImages = {imageNames: uniqueNames};
            }
        });
    }

    return availableImages;
}

module.exports = getAvailableImages;

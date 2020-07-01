// Declare required modules
const fs = require("fs");

// Variables to avoid having to figure out which images exist every call
const checkInterval = 60000;
let lastCheck = null;

// Variable to cache the available images
let availableImages = null;

// Constant regular expressions
const nameEx = /.+(?=_z[0-9]+\.dzi)/g;
const zEx = /(?<=_z).*(?=\.dzi)/g;

function getZLevels(image) {
    fs.readdir("./data", (err, dir) => {
        if (err) {
            image.zLevels = [];
            console.log(`Couldn't find z levels for ${image.name}`);
            return;
        }
        // Only look at dzi files for the right name
        const nameFilter = RegExp(`^${image.name}.*\.dzi$`);
        const names = dir.filter((name) => nameFilter.test(name));

        // Isolate the z levels in the dzi filenames
        const zLevels = names.map((name) => name.match(zEx)).flat();
        image.zLevels = zLevels;
    });
}

function getThumbnails(image) {
    fs.readdir("./data", (err, dir) => {
        if (err) {
            image.thumbnails = {};
            console.log(`Couldn't find thumbnails for ${image.name}`);
            return;
        }
        // Find the file directories for the image name
        const nameFilter = RegExp(`^${image.name}.*_files$`);
        const names = dir.filter((name) => nameFilter.test(name));

        // Look through the middle file directory
        const fileDir = names[Math.floor(names.length / 2)];
        fs.readdir(`./data/${fileDir}`, (err, dir) => {
            // Sort the directories numerically
            dir = dir.sort((a, b) => +a - +b);

            // Look through each directory to find thumbnails
            let idx = 0;
            const thumbnails = {overview: null, detail: null};
            image.thumbnails = thumbnails;
            function findThumbnails(){
                if (idx === dir.length) {
                    return;
                }
                const path = `./data/${fileDir}/${dir[idx]}`;
                fs.readdir(path, (err, dir) => {
                    if (err) {
                        // TODO: Handle errors
                    }

                    // Store suitable thumbnails
                    if (dir.length === 1) {
                        thumbnails.overview = `${path}/${dir[0]}`;
                    }
                    else if (dir.length > 16) {
                        const middle = Math.floor(dir.length / 2);
                        thumbnails.detail = `${path}/${dir[middle]}`;
                    }

                    // Check if all thumbnails have been found
                    if (!(thumbnails.overview && thumbnails.detail)) {
                        idx++;
                        findThumbnails();
                    }
                });
            }
            findThumbnails();
        });
    });
}

function updateImages() {
    fs.readdir("./data", (err, dir) => {
        if (err) {
            availableImages = null;
        }

        let names = dir.map((name) => name.match(nameEx)).flat();
        names = names.filter((name) => name !== null);
        const uniqueNames = [... new Set(names)];

        const images = [];
        uniqueNames.map((name) => images.push({name: name}));
        images.map((image) => {
            getZLevels(image);
            getThumbnails(image);
        });

        // TODO: Include information about z values and thumbnails
        availableImages = {images: images};
    });
}

function getAvailableImages() {
    // Update the available images if enough time has passed
    if (lastCheck === null || Date.now() - checkInterval > lastCheck) {
        updateImages();
    }

    return availableImages;
}

// Update the images when the module is first loaded
updateImages();

module.exports = getAvailableImages;

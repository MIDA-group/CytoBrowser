/**
 * @module availableImages
 * @desc Used to look for available images in the /data directory. The
 * function programatically looks for any .dzi images with names ending
 * with a z level, in the format "_z(value).dzi". It provides a list of
 * all z levels for a given image name, as well as paths to two images
 * that can be used as thumbnails for the given image, one overview and
 * one detail image. If a request has been made to the function within
 * a set period of time, the previous result is cached and returned as
 * it is assumed to not change often.
 */

// Declare required modules
const fs = require("fs");
const fsPromises = fs.promises;

// Directory where the data can be found
let dataDir;

// HttpDirectory where the data can be accessed
const dataOutDir = "data"; // Must match Cytobrowser served directory

// Time when the data was last altered
let lastUpdate = 0;

// Whether or not the data failed to load the last time we tried
let lastUpdateFailed = false;

// Variable to cache the available images
let availableImages = null;

// Constant regular expressions
const nameEx = /.+(?=_z[0-9]+\.dzi)/g;
const zEx = /(?<=_z).*(?=\.dzi)/g;

function getZLevels(dir, image) {
    // Only look at dzi files for the right name
    const nameFilter = RegExp(`^${image.name}.*\.dzi$`);
    const names = dir.filter(name => nameFilter.test(name));

    // Isolate the z levels in the dzi filenames
    const zLevels = names.map(name => name.match(zEx)).flat();
    image.zLevels = zLevels.sort((a, b) => +a - +b);
}

/**
 * Look for appropriate thumbnails for a given image. The function finds
 * two different thumbnails, one for an overview and one for a detail view.
 * The overview image is found by looking for the largest image scale that
 * only contains a single image. The detail image is found by taking a tile
 * near the center of an image at the smallest scale over a certain limit.
 * @param {Array<string>} dir The content of the data directory.
 * @param {Object} image The image data of the image for which thumbnails
 * should be found.
 * Thumbnails are returned in image.thumbnails={overview: string, detail: string}
 * @returns {Promise} Promise that resolves once the data is stored.
*/
async function getThumbnails(dir, image) {
    // Find the file directories for the image name
    const nameFilter = RegExp(`^${image.name}.*_files$`);
    const names = dir.filter(name => nameFilter.test(name));

    // Look through the middle file directory
    const fileDir = names[Math.floor(names.length / 2)];
    return fsPromises.readdir(`${dataDir}/${fileDir}`, {withFileTypes: true})
    .then((dir)=>{
        // Directories only
        dir = dir.filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);
        // Sort the directories numerically
        dir = dir.sort((a, b) => +a - +b);

        // Look through each directory to find thumbnails
        let idx = 0;
        let remainingZooms = 4;
        const maxTiles = 200;
        const thumbnails = {overview: null, detail: null};
        image.thumbnails = thumbnails;

        async function findThumbnails(){
            if (idx === dir.length) {
                return;
            }
            const path = `${dataDir}/${fileDir}/${dir[idx]}`;
            const outpath = `${dataOutDir}/${fileDir}/${dir[idx]}`;
            return fsPromises.readdir(path)
                .then( (dir) => {
                    // Store suitable thumbnails
                    if (dir.length === 1) {
                        thumbnails.overview = `${outpath}/${dir[0]}`;
                        thumbnails.detail = thumbnails.overview;
                    }
                    else if (dir.length > 1) {
                        remainingZooms--;
                        const rows = [];
                        const cols = [];
                        dir.map(name => {
                            const nums = name.split(/[_\.]/);
                            rows.push(+nums[0]);
                            cols.push(+nums[1]);
                        });
                        const row = rows.sort((a,b) => a - b)[Math.floor(rows.length / 2)];
                        const col = cols.sort((a,b) => a - b)[Math.floor(cols.length / 2)];
                        const choice = dir.find(file => RegExp(`${row}[^0-9]+${col}`).test(file));
                        thumbnails.detail = `${outpath}/${choice}`;
                    }

                    // Check if all thumbnails have been found
                    if (!(thumbnails.overview && thumbnails.detail)
                        || remainingZooms > 0
                        && dir.length < maxTiles) {
                        idx++;
                        return findThumbnails();
                    }
                })
                .catch( (err) => { //failure to read subdir
                    // TODO: Handle errors
                    console.error(err.toString());
                });
        }
        return findThumbnails();
    })
    .catch((err) => { //failure to read main dir
        // TODO: Handle errors
        console.error(err.toString());
    });
}

function handleDirError(err) {
    lastUpdateFailed = true;
    if (err.code === "ENOENT") {
        console.error(`WARNING -- The specified data directory \`${dataDir}\` does not exist.`);
        availableImages = {images: [], missingDataDir: true};
    }
    else {
        console.error(err.toString());
        availableImages = null;
    }
}

/**
 * Update the cached image information. This function stores information
 * about the existing images in availableImages, which can be retrieved
 * multiple times without having to call this function again.
 */
async function updateImages() {
    return fsPromises.readdir(dataDir)
    .then( (dir) => {
        let names = dir.map(name => name.match(nameEx)).flat();
        names = names.filter(name => name !== null);
        const uniqueNames = [... new Set(names)];

        const images = [];
        uniqueNames.map(name => images.push({name: name}));
        Promise.all(images.map(image => {
            getZLevels(dir, image);
            return getThumbnails(dir, image);
        }))
        availableImages = {images: images};
    })
    .catch( (err) => {
        handleDirError(err);
    });
}

/**
 * Look to see if any data has changed since the last time it was
 * collected. If it has, fetch the new data.
 */
function checkForDataUpdates() {
    fs.stat(dataDir, (err, stats) => {
        if (err) {
            handleDirError(err);
            return;
        }

        const updateTime = stats.ctime.getTime();
        if (updateTime !== lastUpdate || lastUpdateFailed) {
            updateImages();
            lastUpdate = updateTime;
            lastUpdateFailed = false;
        }
    })
}

/**
 * Get the currently available images from the /data directory on the
 * server.
 * @returns {Array} An array of image information, each entry including
 * an image name, an array of z levels, and two thumbnail routes.
 */
function getAvailableImages() {
    return availableImages;
}

module.exports = function(dir) {
    if (!dir || typeof dir !== "string") {
        throw new Error("A data directory has to be specified.");
    }
    dataDir = dir;
    checkForDataUpdates();
    setInterval(checkForDataUpdates, 10000);
    return getAvailableImages;
}

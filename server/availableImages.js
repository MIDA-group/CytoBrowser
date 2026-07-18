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

const path = require('node:path');

// Declare required modules
const fs = require("fs");
const fsPromises = fs.promises;

// Directory where the data can be found
let dataDir;

// The current subdirectory
let activePath = "";
let activeDir;

// HttpDirectory where the data can be accessed
const dataOutDir = "data"; // Must match Cytobrowser served directory

// Where the data was last updated
let lastUpdateDir = null;

// Time when the data was last altered
let lastUpdate = 0;

// Whether or not the data failed to load the last time we tried
let lastUpdateFailed = false;

// Variable to cache the available images
let availableImages = null;

// Constant regular expressions
const nameEx = /.+(?=_z-?[0-9]+\.dzi$)/;
const filesEx = /.*(?=_z-?[0-9]+_files$)/;
const zEx = /(?<=_z).*(?=\.dzi$)/;

// Following symlinks (synchronous)
function _isFile(dirent) {
    return dirent.isFile() || (dirent.isSymbolicLink() && fs.statSync(path.join(dirent.parentPath,dirent.name), {throwIfNoEntry: false})?.isFile());
}
function _isDirectory(dirent) {
    return dirent.isDirectory() || (dirent.isSymbolicLink() && fs.statSync(path.join(dirent.parentPath,dirent.name), {throwIfNoEntry: false})?.isDirectory());
}

function getZLevels(dir, image) {
    // Only look at dzi files for the right name
    const nameFilter = RegExp(`^${path.basename(image.name)}.*\.dzi$`);
    const names = dir.filter(dirent => _isFile(dirent) && nameFilter.test(dirent.name))
        .map(dirent => dirent.name);

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
 * @param {Array<fs.Dirent>} dir The content of the data (sub)directory.
 * @param {Object} image The image data of the image for which thumbnails
 * should be found.
 * Thumbnails are returned in image.thumbnails={overview: string, detail: string}
 * @returns {Promise} Promise that resolves once the data is stored.
*/
async function getThumbnails(dir, image) {
    // Find the file directories for the image name
    const nameFilter = RegExp(`^${path.basename(image.name)}.*_files$`);
    const names = dir.filter(dirent => _isDirectory(dirent) && nameFilter.test(dirent.name))
        .map(dirent => dirent.name);

    // Look through the middle file directory
    const fileDir = names[Math.floor(names.length / 2)];
    return fsPromises.readdir(path.join(activeDir,fileDir), {withFileTypes: true})
    .then((dir)=>{
        // Directories only
        dir = dir.filter(dirent => _isDirectory(dirent))
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
            const inpath = path.join(dataDir,activePath,fileDir,dir[idx]);
            const outpath = path.join(dataOutDir,activePath,fileDir,dir[idx]);
            return fsPromises.readdir(inpath)
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
        console.error(`WARNING -- The specified data directory \`${activeDir}\` does not exist.`);
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
    return fsPromises.readdir(activeDir, {withFileTypes: true})
    .then( (dir) => {
        const images = [];
        {
            let names = dir.filter(dirent => _isFile(dirent))
                .map(dirent => dirent.name.match(nameEx)).flat(); // One hit for each z-level
            names = names.filter(name => name !== null);
            const uniqueNames = [... new Set(names)];
            uniqueNames.map(name => images.push({name: path.join(activePath,name)}));
        }

        // All non '*z-?[0-9]+_files' directories; relative paths (from activePath are returned)
        const directories = [];
        if (activePath != path.normalize('')) {
            directories.push({name: '..', path: path.join(activePath,'..')});
        }
        {
            dir.filter(dirent => _isDirectory(dirent) && !filesEx.test(dirent.name))
            .map(dirent => directories.push({name: dirent.name, path: path.join(activePath,dirent.name)}));
        }

        return Promise.all(images.map(image => {
            getZLevels(dir, image);
            return getThumbnails(dir, image);
        }))
            .then( () => {
                availableImages = {images: images, directories: directories};
                lastUpdateDir = activeDir;
                lastUpdateFailed = false;
            } );
    })
    .catch( (err) => {
        console.error(err.toString());
        handleDirError(err);
    });
}

/**
 * Look to see if any data has changed since the last time it was
 * collected. If it has, fetch the new data.
 */
async function checkForDataUpdates(forceUpdate=false) {
    return fsPromises.stat(activeDir)
    .then( (stats) => {
        if (activeDir !== lastUpdateDir || lastUpdateFailed || forceUpdate ) {
            return updateImages();
        }
    })
    .catch( (err) => {
        handleDirError(err);
    });
}

/**
 * Get the currently available images from the /data directory on the
 * server.
 * @returns {Promise<Array<Object>>} A promise of the list of available
 * images; each entry including an image name, an array of z levels, 
 * and two thumbnail routes.
 * 
 * We expect **sanitized** inPath!
 */
async function getAvailableImages(inPath='') {
    // console.log('Asking for images: ',inPath);
    if (inPath === activePath) {
        return availableImages;
    }
    else { //rescan if new directory
        activePath = inPath;
        activeDir = path.join(dataDir,activePath);
        // console.log('Scanning for images: ',activeDir);
        await checkForDataUpdates();
        // console.log('Got images: ',availableImages);
        return availableImages;
    }
}

module.exports = function(dir) {
    if (!dir || typeof dir !== "string") {
        throw new Error("A data directory has to be specified.");
    }
    dataDir = dir;
    activeDir = dir;
    checkForDataUpdates();
    setInterval(checkForDataUpdates, 10000); //Check every 10s
    return getAvailableImages;
}

/**
 * Functions for saving, loading, and browsing files stored in the
 * storage directory of the server.
 * @namespace remoteStorage
 */
const remoteStorage = (function() {
    "use strict";

    function _httpGet(address){
        const req = new XMLHttpRequest();
        req.open("GET", address, true);
        req.send();

        return new Promise((resolve, reject) => {
            req.onreadystatechange = function() {
                if (req.readyState !== 4) {
                    return;
                }
                if (req.status === 200) {
                    const data = JSON.parse(req.responseText);
                    resolve(data);
                }
                else {
                    reject(new Error(`HTTP Response: ${req.status}.`));
                }
            }
        });
    }

    /**
     * Save an object as a JSON file on the server.
     * @param {Object} data The object to store on the server.
     * @param {string} filename The filename to store the object as.
     */
    function saveJSON(data, filename){
        if (!filename.match(/.json$/)) {
            filename += ".json";
        }
        const req = new XMLHttpRequest();
        req.open("POST", `${window.location.origin}/api/storage/${filename}`);
        req.setRequestHeader("Content-Type", "application/json");
        req.send(JSON.stringify(data));

        req.onreadystatechange = function() {
            if (req.readyState !== 4) {
                return;
            }
            if (req.status === 201) {
                console.info(`Saved file "${filename}" remotely.`);
            }
        }
    }

    /**
     * Load a JSON file as an object from the server.
     * @param {string} filename The name of the file to be loaded.
     * @returns {Promise<Object>} A promise that resolves with the loaded object.
     */
    function loadJSON(filename){
        return _httpGet(`${window.location.origin}/api/storage/${filename}`);
    }

    /**
     * Get a list of available files from the server.
     * @returns {Promise<Array<string>>} Promise that resolves with the
     * filenames in the storage directory.
     */
    function files(){
        return _httpGet(`${window.location.origin}/api/storage`)
        .then(data => data.files);
    }

    return {
        saveJSON: saveJSON,
        loadJSON: loadJSON,
        files: files
    };
})();

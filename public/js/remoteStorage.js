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
                    alert(`${req.status}: ${req.responseText}`);
                    reject(new Error(`${req.status}: ${req.responseText}`));
                }
            }
        });
    }

    /**
     * Save an object as a JSON file on the server.
     * @param {Object} data The object to store on the server.
     * @param {string} filename The filename to store the object as.
     * @param {string} path The pre-existing path where the file should
     * be stored on the server, relative to the root storage directory.
     * @param {boolean} [overwrite=false] Force overwrite if file with
     * the same name already exists.
     * @param {boolean} [reversion=false] Whether or not a file with
     * the same name as this one should be marked as an older version.
     * @returns {Promise} A promise that resolves if the file is saved,
     * or rejects if it isn't.
     */
    function saveJSON(data, filename, path = "", overwrite = false, reversion = false){
        if (!filename.match(/.json$/)) {
            filename += ".json";
        }
        const req = new XMLHttpRequest();
        req.open("POST", `${window.location.api}/storage`
        + `?filename="${filename}"&path="${path}"`
        + `&overwrite=${overwrite ? 1 : 0}`
        + `&reversion=${reversion ? 1 : 0}`);
        req.setRequestHeader("Content-Type", "application/json");

        return new Promise((resolve, reject) => {
            req.send(JSON.stringify(data));
            req.onreadystatechange = function() {
                if (req.readyState !== 4) {
                    return;
                }
                if (req.status === 201) {
                    console.info(`Saved file "${filename}" remotely.`);
                    resolve();
                }
                // Is 300 the best code to use for this? Unsure
                else if (req.status === 300) {
                    tmappUI.choice("A file with this name already exists", [
                        {
                            label: "Create new version",
                            click: () => saveJSON(data, filename, path, false, true)
                            .then(resolve())
                            .catch(err => reject(err))
                        },
                        {
                            label: "Overwrite most recent version",
                            click: () => saveJSON(data, filename, path, true, false)
                            .then(resolve())
                            .catch(err => reject(err))
                        }
                    ]);
                }
                else {
                    alert(`${req.status}: ${req.responseText}`);
                    reject(new Error(`${req.status}: ${req.responseText}`));
                }
            }
        });
    }

    /**
     * Load a JSON file as an object from the server.
     * @param {string} filepath The path and name of the file to be loaded,
     * relative to the root of the server storage directory.
     * @returns {Promise<Object>} A promise that resolves with the loaded object.
     */
    function loadJSON(filepath){
        return _httpGet(`${window.location.base}/storage/${filepath}`);
    }

    /**
     * Get a list of available files from the server.
     * @returns {Promise<Array<FileEntry>>} Promise that resolves with the
     * file entry descriptions in the storage directory.
     */
    function files(){
        const fileSorter = (a, b) => a.type > b.type || a.name > b.name;
        return _httpGet(`${window.location.api}/storage`)
        .then(data => {
            const files = data.files;
            function addBackTraversal(parentContent, entry) {
                if (entry.type === "directory") {
                    entry.content.forEach(subentry => {
                        addBackTraversal(entry.content, subentry);
                    });
                    entry.content.push({
                        name: "..",
                        type: "directory",
                        content: parentContent
                    });
                    entry.content.sort(fileSorter);
                }
            }
            files.forEach(entry => addBackTraversal(files, entry));
            files.sort(fileSorter);
            return files;
        });
    }

    return {
        saveJSON: saveJSON,
        loadJSON: loadJSON,
        files: files
    };
})();

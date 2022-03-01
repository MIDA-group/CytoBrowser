/**
 * Handling the storage of JSON data on the local machine.
 * @namespace localStorage
 */
const localStorage = (function (){
    "use strict";

    /**
     * General function for saving an arbitrary object as a JSON file
     * with UTF-8 encoding on the local machine.
     * @param {Object} data The data to be converted to a JSON string
     * and saved.
     */
    function saveJSON(data) {
        // Check if the data is actually an object first
        const type = typeof data;
        if (type !== "object") {
            throw new Error(`Expected an object, got a ${type} instead.`);
        }

        // Create a hidden anchor element and use it to save data
        const dataJSON = encodeURIComponent(JSON.stringify(data, null, 4));
        const fileData = `text/json;charset=utf-8,${dataJSON}`;
        const a = document.createElement("a");
        a.setAttribute("href", `data:${fileData}`);
        a.setAttribute("download", "annotation.json");
        a.setAttribute('visibility', 'hidden');
        a.setAttribute('display', 'none');
        a.click();
        a.remove();
    }

    /**
     * Load a JSON file from a specified input element.
     * @param {string} fileInputId The id of the input DOM element to
     * which the file has been uploaded.
     * @returns {Promise<Object>} A promise that resolves with the loaded
     * JSON file converted to an Object.
     */
    function loadJSON(fileInputId) {
        const input = $(`#${fileInputId}`);
        if (!input.length) {
            throw new Error("Unable to find specified file input element.");
        }
        if (!window.File || !window.FileReader || !window.FileList || !window.Blob) {
            throw new Error("The File APIs are not fully supported in this browser.");
        }
        const file = input.prop("files")[0];
        if(!file){
            alert("No file selected");
            return;
        }
        if (!file.type.match('json')) {
            alert("File should be json");
            return;
        }

        function loadFile(resolve, reject) {
            const reader = new FileReader();
            reader.readAsText(file);
            reader.onload = function(event) {
                const data = JSON.parse(event.target.result);
                resolve(data);
            }
            reader.onabort = function() {
                reject(new Error("File upload aborted."));
            }
        }

        return new Promise(loadFile);
    }

    return {
        saveJSON,
        loadJSON
    };
})();

/**
 * Handling the storage of JSON data on the local machine.
 * @namespace localStorage
 */
const localStorage = (function (){
    const _fileInputId = "data_files_import";

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
        a.setAttribute("download", "data.json");
        a.setAttribute('visibility', 'hidden');
        a.setAttribute('display', 'none');
        a.click();
        a.remove();
    }

    /**
     * Load a JSON file from the predetermined input element of the DOM.
     * @returns {Promise<Object>} A promise that resolves with the loaded
     * JSON file converted to an Object.
     */
    function loadJSON() {
        const input = $(`#${_fileInputId}`);
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
    }

    return {
        saveJSON: saveJSON,
        loadJSON: loadJSON
    };
})();

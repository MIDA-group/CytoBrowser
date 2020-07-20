/**
 * Handling the storage of markers on the local machine.
 * @namespace localStorage
 */
const localStorage = (function (){
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

    return {
        saveJSON: saveJSON
    };
})();

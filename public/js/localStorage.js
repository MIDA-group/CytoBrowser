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
        const a = $("<a></a>");
        const dataJSON = encodeURIComponent(JSON.stringify(data, 0, 4));
        const fileData = `text/json;charset=utf-8,${dataJSON}`;
        a.attr({
            href: `data:${fileData}`,
            download: "data.json",
            visibility: "hidden",
            display: "none"
        });
        a.click();
        a.remove();
    }

    return {
        saveJSON: saveJSON
    };
})();

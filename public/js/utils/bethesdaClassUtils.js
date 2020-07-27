/**
 * Information about the representation of the different classes from
 * The Bethesda System of classification.
 * @namespace bethesdaClassUtils
 */
const bethesdaClassUtils = (function(){
    "use strict";

    /**
     * Information for a specific class in The Bethesda System, including
     * information about its visual representation in the user interface.
     * @typedef {Object} BClass
     * @property {string} name The abbreviated name of the class.
     * @property {string} description The extended description of the
     * class name.
     * @property {string} color The color used to represent the class.
     */
    const _classes = [
        {
            name: "NILM",
            description: "Negative for intraepithelial lesion or malignancy",
            color: "#3F3"
        },
        {
            name: "ASC-US",
            description: "Atypical squamous cells of undetermined significance",
            color: "#CA3"
        },
        {
            name: "ASC-H",
            description: "Atypical squamous cell - cannot exclude HSIL",
            color: "#F33"
        },
        {
            name: "LSIL",
            description: "Low squamous intraepithelial lesion",
            color: "#3CC"
        },
        {
            name: "HSIL",
            description: "High squamous intraepithelial lesion",
            color: "#F4F"
        },
        {
            name: "SCC",
            description: "Squamous cell carcinoma",
            color: "#CF6"
        },
        {
            name: "AdC",
            description: "Adenocarcinoma",
            color: "#FC6"
        }
    ];

    /**
     * Get the color assigned for a given class.
     * @param {number|string} idOrName Either the id of the given class
     * or its name.
     * @returns {string} An RGB hex representation of the color.
     */
    function classColor(idOrName) {
        let id = idOrName;
        if (typeof(id) === "string") {
            id = bethesdaClassUtils.getIDFromName(idOrName);
        }
        return _classes[id].color;
    }

    /**
     * Get a glass based on its id.
     * @param {number} id The id of the sought class.
     * @returns {BClass} The class with the corresponding id.
     */
    function getClassFromID(id) {
        return _classes[id];
    }

    /**
     * Get the id of a class based on its name.
     * @param {string} name The name of the class.
     * @returns {number} The id of the class.
     */
    function getIDFromName(name) {
        return _classes.findIndex((entry) => name == entry.name);
    }

    /**
     * Execute a function with each class as an argument.
     * @param {Function} f The function to be executed with the classes.
     */
    function forEachClass(f) {
        _classes.forEach(f);
    }

    return {
        count: () => _classes.length,
        classColor: classColor,
        getClassFromID: getClassFromID,
        getIDFromName: getIDFromName,
        forEachClass: forEachClass
    }
})();

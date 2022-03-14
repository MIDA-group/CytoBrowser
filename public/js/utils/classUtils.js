/**
 * Information about the representation of the different classes specified
 * in the classConfig.js file.
 * @namespace classUtils
 */
const classUtils = (function(){
    "use strict";

    /**
     * Information for a specific class from the class configuration, including
     * information about its visual representation in the user interface.
     * @typedef {Object} MClass
     * @property {string} name The abbreviated name of the class.
     * @property {string} description The extended description of the
     * class name.
     * @property {string} color The color used to represent the class.
     */
    let _classes = classConfig;

    /**
     * Get the name of each class in the current classification system.
     * @returns {Array<string>} _classes
     */
    function getSortedClassesNames() {
        let classesNames = [];
        _classes.forEach((entry) => classesNames.push(entry.name));
        return classesNames.sort();
    }

    /**
     * Set the classification system based on a new configuration.
     * @param {Object} classConfig 
     */
    function setClassConfig(updatedClassConfig) {
        if (updatedClassConfig !== undefined && updatedClassConfig.length >= 1) {
            _classes = updatedClassConfig;
        }
        else {
            _classes = classConfig;
        }
        
    }

    /**
     * Get the color assigned for a given class.
     * @param {number|string} idOrName Either the id of the given class
     * or its name.
     * @returns {string} An RGB hex representation of the color.
     */
    function classColor(idOrName) {
        let id = idOrName;
        if (typeof(id) === "string") {
            id = classUtils.getIDFromName(idOrName);
        }
        return _classes[id].color;
    }

    /**
     * Get a glass based on its id.
     * @param {number} id The id of the sought class.
     * @returns {MClass} The class with the corresponding id.
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
        getSortedClassesNames: getSortedClassesNames,
        setClassConfig: setClassConfig,
        classColor: classColor,
        getClassFromID: getClassFromID,
        getIDFromName: getIDFromName,
        forEachClass: forEachClass
    }
})();

/**
 * Information about the representation of the different classes specified
 * in the defaultClassConfig.js file.
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
    let _classes = defaultClassConfig;

    /**
     * Get a sorted array containing the name of each class in a given class system.
     * @returns {Array<string>}
     */
    function getSortedNames(class_system) {
        let classesNames = [];
        class_system.forEach((entry) => classesNames.push(entry.name));
        return classesNames.sort();
    }

    /**
     * Check whether a class system corresponds to the default system.
     * @param {Object} class_system
     * @returns {Boolean} indicates whether the argument class_system is the default system.
     */
    function isDefaultClassSystem(class_system) {
        return (compareTwoClassSystems(class_system, defaultClassConfig) || class_system.length === 0);
    }

    /**
     * Compare two class systems by name of classes, ignoring the class order
     * @param {Object} class_system_a the first class system
     * @param {Object} class_system_b the second class system
     * @returns {Boolean} indication whether the given class sytems have the same classes
     */
    function compareTwoClassSystems(class_system_a, class_system_b) {
        let sorted_classNames_a = getSortedNames(class_system_a);
        let sorted_classNames_b = getSortedNames(class_system_b);

        let sameClassLenghts = class_system_a.length === class_system_b.length;

        let sameClassNames = sorted_classNames_a.every(function(value, index) {
            return value === sorted_classNames_b[index];
        });

        return (sameClassLenghts && sameClassNames);
    }

    /**
     * Get the current class system.
     * @returns {Object}
     */
    function getClassConfig() {
        return _classes;
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
            _classes = defaultClassConfig;
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
        getSortedNames,
        isDefaultClassSystem,
        compareTwoClassSystems,
        getClassConfig,
        setClassConfig,
        classColor,
        getClassFromID,
        getIDFromName,
        forEachClass
    }
})();

/**
 * Base class for overlay layers in CyBr
 */

class OverlayLayer {
    name = "unnamed";
    #requiredFunctions = ["setZ","blur","focus"];
    
    constructor(name) {
        if (this.constructor === OverlayLayer) {
            throw new Error("Cannot instatiate abstract class!");
        }
    
        this.#requiredFunctions.forEach(fun => {
                if (typeof this[fun] !== "function") {
                    throw new Error(`Function "${fun}" must be implemented in derived class`);
                }
            });

        this.name = name;
    }

    _getAnnotationColor(d) {
        return classUtils.classColor(d.mclass);
    }

    _getAnnotationText(d) {
        if (d.prediction == null) { //null or undef
            return `${d.mclass}`;
        }
        return `${d.prediction.toFixed(4)}: ${d.mclass}`;
    }

    /**
     * Convenience function for creating a function that can be run
     * to edit transforms with d3.
     * @param {Object} transform The transform that should be applied
     * with the returned function.
     */
    static transformFunction(transform) {
    
        /**
         * Edit a string with stored in the transform attribute of a node.
         * This function only edits properties already stored in the string,
         * it does not add any. This is because of the fact that the order of
         * transform properties changes the final result. If a property is not
         * specified by the changes argument, it retains its old value.
         * @param {string} transformString The original transform string.
         * @param {Object} changes Key-value pairs of transforms and their
         * changed properties. The keys are the names of the transforms, and
         * the values can either be numbers, Arrays, or Functions. Numbers
         * and Arrays simply assign new values to the transforms. Functions
         * are run on the old values to produce new values.
         * @returns {string} The resulting transform string.
         */
        function _editTransform(transformString, changes) {
            // Turn the transform string into an object
            // Start by finding all the transforms
            const transforms = transformString.match(/[^\s,]+\([^)]*\)/g);
            // Structure the transform as an object
            const transObj = {};
            const names = transforms.map(transform => transform.match(/.+(?=\()/g)[0]);
            transforms.forEach(transform => {
                const name = transform.match(/.+(?=\()/g);
                const values = transform.match(/[-+]?[0-9]*\.?[0-9]+/g);
                transObj[name] = values;
            });

            // Assign the changes
            let result = "";
            names.forEach(name => {
                const value = changes[name];
                if (value !== undefined) {
                    if (Array.isArray(value)) {
                        transObj[name] = value;
                    }
                    else if (typeof value === "function") {
                        transObj[name] = transObj[name].map(value);
                    }
                    else if (typeof value !== "object") {
                        transObj[name] = [value];
                    }
                    else {
                        throw new Error("Invalid transform change.");
                    }
                }
                result += `${name}(${transObj[name].toString()}) `;
            });

            return result;
        }

        return function(d, i) {
            let appliedTransform;
            if (typeof transform === "function") {
                appliedTransform = transform.call(this, d, i);
            }
            else {
                appliedTransform = transform;
            }
            const currTransform = this.getAttribute("transform");
            return _editTransform(currTransform, appliedTransform);
        };
    }
}

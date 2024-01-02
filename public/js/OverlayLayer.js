/**
 * Base class for overlay layers in CyBr
 */

class OverlayLayer {
    name = "unnamed";
    #requiredFunctions = ["setZ"];
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
}

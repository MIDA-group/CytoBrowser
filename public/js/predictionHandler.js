/**
 * Namespace for fetching and handling predictions from the model at
 * the server.
 * @namespace predictionHandler
 */
const predictionHandler = (function (){
    "use strict";

    const _predictions = [];

    function _clonePrediction(prediction) {
        const clone = Object.assign({}, prediction);
        Object.entries(clone).forEach(([key, value]) => {
            if (value && value.constructor === Array)
                clone[key] = [...value];
        })
        return clone;
    }

    /**
     * Get the predictions made by the model on the server for a given
     * image and store them locally.
     * @param {string} imageName The name of the image for which the
     * predictions should be fetched.
     */
    function fetch(imageName) {
        clear();

        // TODO: Get from server instead of generating
        const prediction = {
            id: 0,
            x: 50000,
            y: 50000,
            z: 0,
            certainty: 0.95,
            mclass: "NILM"
        };

        _predictions.push(prediction);
        predictionVisuals.update(_predictions);
    }

    /**
     * Clear the currently stored predictions from local storage
     */
    function clear() {
        _predictions.length = 0;
        predictionVisuals.update(_predictions);
    }

    /**
     * Get a copy of the specified prediction by its id.
     * @param {number} id The id used for looking up the prediction.
     * @returns {Object} A clone of the prediction or undefined if no
     * prediction with the given id exists.
     */
    function getPredictionById(id) {
        const prediction = _predictions.find(prediction => prediction.id === id);
        if (prediction === undefined) {
            return undefined;
        }
        const predictionClone = _clonePrediction(prediction);
        return _predictions[0];
    }

    // Function for debugging
    function print() {
        _predictions.forEach(pred => console.info(pred));
    }

    return {
        fetch: fetch,
        clear: clear,
        getPredictionById: getPredictionById,
        print: print
    };
})();

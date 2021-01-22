/**
 * Namespace for fetching and handling predictions from the model at
 * the server.
 * @namespace predictionHandler
 */
const predictionHandler = (function (){
    "use strict";

    const _predictions = [];

    function _drawPredictions() {
        predictionVisuals.update(_predictions);
    }

    /**
     * Get the predictions made by the model on the server for a given
     * image and store them locally.
     * @param {string} imageName The name of the image for which the
     * predictions should be fetched.
     */
    function fetchPredictions(imageName) {
        clearPredictions();

        // TODO: Get from server instead of generating
        const prediction = {
            id: 0,
            x: 50000,
            y: 50000,
            z: 0,
            mclass: "NILM"
        };

        _predictions.push(prediction);
        _drawPredictions();
    }

    /**
     * Clear the currently stored predictions from local storage
     */
    function clearPredictions() {
        _predictions.length = 0;
    }

    // Function for debugging
    function printPredictions() {
        _predictions.forEach(pred => console.info(pred));
    }

    return {
        fetchPredictions: fetchPredictions,
        clearPredictions: clearPredictions,
        printPredictions: printPredictions
    };
})();

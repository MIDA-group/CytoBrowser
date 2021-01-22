const predictionHandler = (function (){
    "use strict";

    const _predictions = [];

    /**
     * Get the predictions made by the model on the server for a given
     * image and store them locally.
     * @param {string} imageName The name of the image for which the
     * predictions should be fetched.
     */
    function fetchPredictions(imageName) {
        // TODO: Get from server instead of generating
        const prediction = {
            id: 0,
            x: 50000,
            y: 50000,
            z: 0,
            mclass: "NILM"
        };

        _predictions.push(prediction);
    }

    /**
     * Clear the currently stored predictions from local storage
     */
    function clearPredictions() {
        _predictions.length = 0;
    }

    return {
        fetchPredictions: fetchPredictions,
        clearPredictions: clearPredictions
    };
})();

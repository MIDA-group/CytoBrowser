/**
 * Namespace for handling the visual representation of predictions by
 * the model.
 * @namespace predictionVisuals
 */
const predictionVisuals = (function() {
    "use strict";

    /**
     * Update the current visuals for the predictions.
     * @param {Array} predictions All currently placed predictions.
     */
    function update(predictions) {
        overlayHandler.updatePredictions(predictions);
        tableHandler.updatePredictions(predictions);
    }

    return {
        update: update
    };
})();

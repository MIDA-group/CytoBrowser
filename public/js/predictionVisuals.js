/**
 * Namespace for handling the visual representation of predictions by
 * the model.
 * @namespace predictionVisuals
 */
const predictionVisuals = (function() {
    "use strict";

    const _tableId = "tmcptablebody";

    function update(predictions) {
        // predictions is a list of predictions
        // TODO: List the predictions somewhere?

        overlayHandler.updatePredictions(predictions);
    }

    return {
        update: update
    };
})();

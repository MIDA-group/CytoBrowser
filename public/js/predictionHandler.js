/**
 * Namespace for fetching and handling predictions from the model at
 * the server.
 * @namespace predictionHandler
 */
const predictionHandler = (function (){
    "use strict";

    /**
     * Representation of the cell classification predictions made by the
     * server-side algorithm.
     * @typedef {Object} Prediction
     * @property {number} id The id of the prediction.
     * @property {number} x The x coordinate of the prediction.
     * @property {number} y The y coordinate of the prediction.
     * @property {number} z The focus level of the prediction.
     * @property {number} certainty The certainty of the classification
     * made by the algorithm.
     * @property {string} mclass Predicted class.
     */

    const _predictions = [];

    function _clonePrediction(prediction) {
        const clone = Object.assign({}, prediction);
        Object.entries(clone).forEach(([key, value]) => {
            if (value && value.constructor === Array)
                clone[key] = [...value];
        })
        return clone;
    }

    // TODO: Same functionality as in remoteStorage, refactor
    function _httpGet(address){
        const req = new XMLHttpRequest();
        req.open("GET", address, true);
        req.send();

        return new Promise((resolve, reject) => {
            req.onreadystatechange = function() {
                if (req.readyState !== 4) {
                    return;
                }
                if (req.status === 200) {
                    const data = JSON.parse(req.responseText);
                    resolve(data);
                }
                else {
                    alert(`${req.status}: ${req.responseText}`);
                    reject(new Error(`${req.status}: ${req.responseText}`));
                }
            }
        });
    }

    function _addPredictionsFromData(data) {
        const ids = data.id;
        ids.forEach((id, i) => {
            const prediction = {
                id: id,
                x: data.x[i],
                y: data.y[i],
                z: data.z[i],
                certainty: data.certainty[i],
                mclass: data.mclass[i]
            };
            _predictions.push(prediction);
        });
    }

    function _updateVisuals() {
        predictionVisuals.update(_predictions);
    }

    /**
     * Get the predictions made by the model on the server for a given
     * image and store them locally.
     * @param {string} imageName The name of the image for which the
     * predictions should be fetched.
     */
    function fetch(imageName) {
        clear();
        const address = `${window.location.origin}/api/predictions/${imageName}`;
        _httpGet(address)
            .then(_addPredictionsFromData)
            .then(_updateVisuals);
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

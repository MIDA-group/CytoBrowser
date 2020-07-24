/**
 * Deals with converting between marker storage objects and placed marker
 * data. Functions in this namespace can either be used to get the
 * currently placed markers as a storage object, which can be used for
 * either local or remote storage in a JSON file, or to add markers from
 * an already existing marker storage object.
 * @namespace markerStorageConversion
 */
const markerStorageConversion = (function() {
    /**
     * A JSON representation of currently placed markers.
     * @typedef {Object} MarkerStorage
     * @param {number} version The specific version of the marker storage
     * object, for back-compatibility reasons.
     * @param {string} name The name of the image where the markers were
     * initially placed.
     * @param {Array<markerHandler.Marker>} markers The actual data for 
     * the markers.
     */

    /**
     * Add markers from a marker storage object.
     * @param {Object} data The storage object containing marker
     * information.
     * @param {boolean} [clear = false] Whether or not the already
     * placed markers should be removed before adding the new markers.
     */
    function addMarkerStorageData(data, clear = false) {
        switch (data.version) {
            case "1.0":
                // Change image if data is for another image
                if (data.image !== tmapp.getImageName()) {
                    tmapp.openImage(data.image, () => {
                        collabClient.swapImage(data.image);
                        data.markers.forEach(marker => {
                            markerHandler.addMarker(marker, "image");
                        });
                    });
                    break;
                }
                clear && markerHandler.clearMarkers();
                data.markers.forEach(marker => {
                    markerHandler.addMarker(marker, "image");
                })
                break;
            default:
                throw new Error(`Data format version ${data.version} not implemented.`);
        }
    }

    /**
     * Convert the currently placed markers to a marker storage object.
     * @returns {Object} The marker storage representation of the markers.
     */
    function getMarkerStorageData() {
        const data = {
            version: "1.0", // Version of the formatting
            image: tmapp.getImageName(),
            markers: []
        };
        markerHandler.forEachMarker(marker => {
            data.markers.push(marker)
        });
        return data;
    }

    return {
        addMarkerStorageData: addMarkerStorageData,
        getMarkerStorageData: getMarkerStorageData
    }
})();

const markerStorageConversion = (function() {
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
            image: _currentImage.name,
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

/**
 * Namespace for handling markers. Deals with both the data
 * representation of the markers and the graphical representation. All
 * manipulation of the markers should go through this namespace's
 * functions to ensure that all necessary steps are performed.
 * @namespace markerHandler
 */
const markerHandler = (function (){
    "use strict";
    /**
     * Data representation of a marker that should be used when adding or
     * updating information about it. While all markers that have already
     * been added will have an id property, it can optionally be included
     * when adding information about the marker to force an id.
     * @typedef {Object} Marker
     * @property {number} x X position of the marker.
     * @property {number} y Y position of the marker.
     * @property {number} z Z value when the marker was placed.
     * @property {string} mclass Class name of the marker.
     * @property {number} [id] Hard-coded ID of the marker.
     */
    /**
     * Representation of the OpenSeadragon coordinate system used to
     * represent a point. Should take on the values of "web", "viewport"
     * or "image". See more information about the different coordinate
     * systems {@link https://openseadragon.github.io/examples/viewport-coordinates/|here.}
     * @typedef {string} CoordSystem
     */
    const _markers = [];
    let _nextId = 0;
    function _generateId() {
        let id = _nextId;
        if (getMarkerById(id) !== undefined) {
            // If for some reason the next id has already been taken
            const markers = _markers;
            const maxId = Math.max(...markers.map(marker => marker.id));
            id = maxId + 1;
        }
        _nextId = id + 1;
        return id;
    }

    function _cloneMarker(marker) {
        /**
         * Note: This implementation copies references, so if the
         * representation of a marker is ever changed to include a
         * reference to an Object, this function should be changed to
         * take this into account.
         */
        return Object.assign({}, marker);
    }

    function _findDuplicateMarker(marker) {
        return _markers.find(existingMarker =>
            existingMarker.x === marker.x
            && existingMarker.y === marker.y
            && existingMarker.z === marker.z
            && existingMarker.mclass === marker.mclass
        );
    }

    function _getCoordSystems(point, coordSystem) {
        let webPoint, viewportPoint, imagePoint;
        switch(coordSystem) {
            case "web":
                viewportPoint = coordinateHelper.webToViewport(point);
                imagePoint = coordinateHelper.webToImage(point);
                return {
                    web: {x: point.x, y: point.y},
                    viewport: {x: viewportPoint.x, y: viewportPoint.y},
                    image: {x: imagePoint.x, y: imagePoint.y}
                };
            case "viewport":
                webPoint = coordinateHelper.viewportToWeb(point);
                imagePoint = coordinateHelper.viewportToImage(point);
                return {
                    web: {x: webPoint.x, y: webPoint.y},
                    viewport: {x: point.x, y: point.y},
                    image: {x: imagePoint.x, y: imagePoint.y}
                };
            case "image":
                webPoint = coordinateHelper.imageToWeb(point);
                viewportPoint = coordinateHelper.imageToViewport(point);
                return {
                    web: {x: webPoint.x, y: webPoint.y},
                    viewport: {x: viewportPoint.x, y: viewportPoint.y},
                    image: {x: point.x, y: point.y}
                };
            default:
                throw new Error("Invalid OSD coordinate system specified.");
        }
    }


    /**
     * Add a single marker to the data.
     * @param {Marker} marker A data representation of the marker.
     * @param {CoordSystem} [coordSystem="web"] Coordinate system used by the marker.
     * @param {boolean} [transmit=true] Any collaborators should also be
     * told to add the marker.
     */
    function addMarker(marker, coordSystem="web", transmit = true) {
        const addedMarker = _cloneMarker(marker);

        // Check if an identical marker already exists, remove old one if it does
        let replacedMarker = _findDuplicateMarker(addedMarker);
        if (replacedMarker) {
            console.warn("Adding a marker with identical properties to an existing marker, replacing.");
            updateMarker(replacedMarker.id, addedMarker, coordSystem, false);
            return;
        }

        // Make sure the marker has an id
        if (addedMarker.id === undefined) {
            addedMarker.id = _generateId();
        }
        else {
            // If the id has been specified, check if it's not taken
            const existingMarker = getMarkerById(addedMarker.id);
            if (existingMarker !== undefined) {
                console.info("Tried to assign an already-used id, reassigning.");
                addedMarker.originalId === undefined && (addedMarker.originalId = addedMarker.id);
                addedMarker.id = _generateId();
            }
        }

        // Store the coordinates in all systems and set the image coordinates
        const coords = _getCoordSystems(addedMarker, coordSystem);
        if (coordSystem != "image") {
            addedMarker.x = coords.image.x;
            addedMarker.y = coords.image.y;
        }

        // Store a data representation of the marker
        _markers.push(addedMarker);

        // Send the update to collaborators
        transmit && collabClient.addMarker(addedMarker);

        // Add a graphical representation of the marker
        markerVisuals.update(_markers);
    }

    /**
     * Update the parameters of an already existing marker.
     * @param {number} id The initial id of the marker to be updated.
     * @param {Marker} marker The new values for the marker to be updated.
     * @param {CoordSystem} [coordSystem="web"] Coordinate system used by the marker.
     * @param {boolean} [transmit=true] Any collaborators should also be
     * told to update their marker.
     */
    function updateMarker(id, marker, coordSystem="web", transmit = true) {
        const markers = _markers;
        const updatedIndex = markers.findIndex(marker => marker.id == id);
        const updatedMarker = getMarkerById(id);

        // Check if the marker being updated exists first
        if (updatedMarker === undefined) {
            throw new Error("Tried to update a marker that doesn't exist.");
        }

        // If the id is being changed, check if it's not taken
        if (marker.id !== undefined && marker.id !== id) {
            const existingMarker = getMarkerById(marker.id);
            if (existingMarker !== undefined) {
                console.info("Tried to assign an already-used id, keeping old id.");
                marker.originalId = marker.id;
                marker.id = id;
            }
        }

        // Copy over the updated properties
        Object.assign(updatedMarker, marker);

        // Make sure the data is stored in the image coordinate system
        const coords = _getCoordSystems(updatedMarker, coordSystem);
        if (coordSystem != "image") {
            updatedMarker.x = coords.image.x;
            updatedMarker.y = coords.image.y;
        }

        // Store the marker in data
        markers[updatedIndex] = updatedMarker;

        // Send the update to collaborators
        transmit && collabClient.updateMarker(id, updatedMarker);

        // Update the marker in the graphics
        markerVisuals.update(_markers);
    }

    /**
     * Remove a marker from the data.
     * @param {number} id The id of the marker to be removed.
     * @param {boolean} [transmit=true] Any collaborators should also be
     * told to remove the marker.
     */
    function removeMarker(id, transmit = true) {
        const markers = _markers;
        const deletedIndex = markers.findIndex(marker => marker.id == id);

        // Check if the marker exists first
        if (deletedIndex === -1) {
            throw new Error("Tried to remove a marker that doesn't exist");
        }

        // Remove the marker from the data
        markers.splice(deletedIndex, 1);

        // Send the update to collaborators
        transmit && collabClient.removeMarker(id);

        // Remove the marker from the graphics
        markerVisuals.update(_markers);
    }

    /**
     * Remove all markers from the data.
     * @param {boolean} [transmit=true] Any collaborators should also
     * be told to clear their markers.
     */
    function clearMarkers(transmit = true) {
        const markers = _markers;
        const ids = markers.map(marker => marker.id);
        ids.forEach(id => removeMarker(id, false));

        // Send the update to collaborators
        transmit && collabClient.clearMarkers();

        // Clear the overlay
        markerVisuals.clear();
    }

    /**
     * Iterate a function for each marker. The function will not change
     * the values of the marker, and will instead work on clones of them,
     * effectively making them read-only. If the marker values should be
     * updated, updateMarker() can be run in the passed function.
     * @param {function} f Function to be called with each marker.
     */
    function forEachMarker(f) {
        _markers.map(_cloneMarker).forEach(f);
    }

    /**
     * Get a copy of a specified marker by its id.
     * @param {number} id The id used for looking up the marker.
     * @returns {Object} A clone of the marker with the specified id,
     * or undefined if not in use.
     */
    function getMarkerById(id) {
        const marker = _markers.find(marker => marker.id == id);
        if (marker === undefined) {
            return undefined;
        }
        const markerClone = _cloneMarker(marker);
        return markerClone;
    }

    /**
     * Check whether or not the list of marker markers is empty.
     * @returns {boolean} Whether or not the list is empty.
     */
    function empty() {
        return _markers.length === 0;
    }

    // Return public members of the closure
    return {
        addMarker: addMarker,
        updateMarker: updateMarker,
        removeMarker: removeMarker,
        clearMarkers: clearMarkers,
        forEachMarker: forEachMarker,
        getMarkerById: getMarkerById,
        empty: empty
    };
})();

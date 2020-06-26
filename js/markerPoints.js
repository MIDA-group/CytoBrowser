/**
 * Namespace for handling marker points. Deals with both the data
 * representation of the points and the graphical representation.
 * @namespace markerPoints
 */
markerPoints = {
    /**
     * Data representation of a point that should be used when adding or
     * updating information about it. While all points that have already
     * been added will have an id property, it can optionally be included
     * when adding information about the point to force an id.
     * @typedef {Object} MarkerPoint
     * @property {number} x X position of the point.
     * @property {number} y Y position of the point.
     * @property {number} z Z value when the point was placed.
     * @property {string} mClass Class name of the point.
     * @property {number} [id] Hard-coded ID of the point.
     */
    _points: [],
    _nextId: 0,
    _generateId: function() {
        let id = markerPoints._nextId;
        if (markerPoints.getPointById(id) !== undefined) {
            // If for some reason the next id has already been taken
            const points = markerPoints._points;
            const maxId = Math.max(...points.map((point) => point.id));
            id = maxId + 1;
        }
        markerPoints._nextId = id + 1;
        return id;
    },

    /**
     * Add a single point to the data.
     * @param {MarkerPoint} point A data representation of the point.
     * @param {boolean} [pixelCoords=false] Positions in pixel coordinates if true, otherwise viewport coordinates.
     */
    addPoint: function(point, pixelCoords=false) {
        // Make sure the point has an id
        if (point.id === undefined) {
            point.id = markerPoints._generateId();
        }
        else {
            // If the id has been specified, check if it's not taken
            const existingPoint = markerPoints.getPointById(point.id);
            if (existingPoint !== undefined) {
                throw new Error("Tried assign an already-used id.");
            }
        }

        // Add a data representation of the point
        markerPoints._points.push(point);

        // TODO: Add a graphical representation of the point
    },

    /**
     * Update the parameters of an already existing point.
     * @param {number} id The initial id of the point to be updated.
     * @param {MarkerPoint} point The new values for the point to be updated.
     * @param {boolean} [pixelCoords=false] Positions in pixel coordinates if true, otherwise viewport coordinates.
     */
    updatePoint: function(id, point, pixelCoords=false) {
        const updatedPoint = markerPoints.getPointById(id);

        // Check if the point being updated exists first
        if (updatedPoint === undefined) {
            throw new Error("Tried to update a point that doesn't exist.");
        }

        // If the id is being changed, check if it's not taken
        if (point.id !== undefined && point.id !== id) {
            const existingPoint = markerPoints.getPointById(point.id);
            if (existingPoint !== undefined) {
                throw new Error("Tried to update to an already-used id.");
            }
        }

        // Copy over the updated properties
        Object.assign(point, updatedPoint);
    },

    /**
     * Remove a point from the data.
     * @param {number} id The id of the point to be removed.
     */
    removePoint: function(id) {
        const points = markerPoints._points;
        const deletedIndex = points.findIndex((point) => point.id == id);

        // Check if the point exists first
        if (deletedIndex === -1) {
            throw new Error("Tried to remove a point that doesn't exist");
        }

        // Remove the point
        points.splice(deletedIndex, 1);
    },

    /**
     * Remove all points from the data.
     */
    clearPoints: function() {
        markerPoints._points.forEach(function(point) {
            markerPoints.removePoint(point.id);
        });
    },

    /**
     * Get a specified point by its id.
     * @param {number} id The id used for looking up the point.
     * @returns {Object} The point with the specified id, or undefined if not in use
     */
    getPointById: function(id) {
        return markerPoints._points.find((point) => point.id == id);
    }
};

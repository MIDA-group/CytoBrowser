markerPoints = {
    points: [],

    /**
    * Add a single point to the data and take care of the necessary
    * graphics for it.
    * @param {Object} point A data representation of the point.
    * @param {number} point.x X position of the point.
    * @param {number} point.y Y position of the point.
    * @param {number} point.z Z value when the point was placed.
    * @param {string} point.mClass Class name of the point.
    * @param {number} [point.id] Hard-coded ID of the point.
    * @param {boolean} [pixelCoords=false] Positions in pixel coordinates if true, otherwise viewport coordinates.
    */
    addPoint: function(point, pixelCoords=false) {
        throw new Error("Not yet implemented.");
    },
    /**
    * Update the parameters of an already existing point.
    * @param {number} id The initial id of the point to be updated.
    * @param {Object} point The new values for the point to be updated.
    * @param {number} point.x X position of the point.
    * @param {number} point.y Y position of the point.
    * @param {number} point.z Z value when the point was placed.
    * @param {string} point.mClass Class name of the point.
    * @param {number} [point.id] Hard-coded ID of the point.
    * @param {boolean} [pixelCoords=false] Positions in pixel coordinates if true, otherwise viewport coordinates.
    */
    updatePoint: function(id, point, pixelCoords=false) {
        // If the id is being changed, check if it's not taken
        if (point.id !== undefined && point.id !== id) {
            const existingPoint = markerPoints.getPointById(point.id);
            if (existingPoint !== undefined) {
                throw new Error("Tried to update to an already-used id.");
            }
        }

        throw new Error("Not yet implemented.");
    },
    /**
    * Remove a point from the data.
    * @param {number} id The id of the point to be removed.
    */
    removePoint: function(id) {
        throw new Error("Not yet implemented.");
    },
    /**
    * Remove all points from the data.
    */
    clearPoints: function() {
        markerPoints.points.forEach(function(point) {
            markerPoints.removePoint(point.id);
        });
    },
    /**
    * Get a specified point by its id.
    * @param {number} id The id used for looking up the point.
    * @returns {Object} The point with the specified id, or undefined if not in use
    */
    getPointById: function(id) {
        return markerPoints.points.find((point) => point.id == id);
    }
};

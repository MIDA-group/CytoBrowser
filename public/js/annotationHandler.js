/**
 * Namespace for handling annotations. Deals with both the data
 * representation of the annotations and the graphical representation. All
 * manipulation of the annotations should go through this namespace's
 * functions to ensure that all necessary steps are performed.
 * @namespace annotationHandler
 */
const annotationHandler = (function (){
    "use strict";

    /**
     * Data representation of an annotation that should be used when adding or
     * updating information about it. While all annotations that have already
     * been added will have an id property, it can optionally be included
     * when adding information about the annotation to force an id. The
     * same applies to the centroid of the annotation.
     * @typedef {Object} Annotation
     * @property {Array<Object>} points The x and y positions of each
     * point in the annotation; a single point if annotation, multiple
     * if region.
     * @property {number} z Z value when the annotation was placed.
     * @property {string} mclass Class name of the annotation.
     * @property {Object} centroid The centroid of the annotated point
     * or region.
     * @property {Array} [comments] Comments associated with the annotation.
     * @property {string} [author] The name of the person who originally
     * placed the annotation.
     * @property {number} [id] Hard-coded ID of the annotation.
     */
    /**
     * Representation of the OpenSeadragon coordinate system used to
     * represent a point. Should take on the values of "web", "viewport"
     * or "image". See more information about the different coordinate
     * systems {@link https://openseadragon.github.io/examples/viewport-coordinates/|here.}
     * @typedef {string} CoordSystem
     */
    const _annotations = [];
    let _nextId = 0;
    function _generateId() {
        let id = _nextId;
        if (getAnnotationById(id) !== undefined) {
            // If for some reason the next id has already been taken
            const annotations = _annotations;
            const maxId = Math.max(...annotations.map(annotation => annotation.id));
            id = maxId + 1;
        }
        _nextId = id + 1;
        return id;
    }

    function _cloneAnnotation(annotation) {
        // Note: This implementation copies values and makes
        // shallow clones of arrays, will not clone other
        // referenced objects
        const clone = Object.assign({}, annotation);
        Object.entries(clone).forEach(([key, value]) => {
            if (value && value.constructor === Array)
                clone[key] = [...value];
        });
        return clone;
    }

    function _getCentroid(points) {
        if (points.length === 1)
            return points[0];
        else {
            // Wikipedia says this won't work with self-intersections
            // https://en.wikipedia.org/wiki/Centroid#Of_a_polygon
            const loop = [...points, points[0]];
            let area = 0;
            let cx = 0;
            let cy = 0;
            loop.reduce((a, b) => {
                const areaTerm = (a.x * b.y) - (b.x * a.y);
                area += areaTerm;
                cx += (a.x + b.x) * areaTerm;
                cy += (a.y + b.y) * areaTerm;
                return b;
            });
            area /= 2;
            cx /= (6 * area);
            cy /= (6 * area);
            return {x: cx, y: cy};
        }
    }

    function _pointsAreDuplicate(pointsA, pointsB) {
        if (pointsA.length !== pointsB.length)
            return false;

        return pointsA.every((pointA, index) => {
            const pointB = pointsB[index];
            return pointA.x === pointB.x || pointA.y === pointB.y;
        });
    }

    function _findDuplicateAnnotation(annotation) {
        return _annotations.find(existingAnnotation =>
            existingAnnotation.z === annotation.z
            && existingAnnotation.mclass === annotation.mclass
            && _pointsAreDuplicate(annotation.points, existingAnnotation.points)
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
     * Add a single annotation to the data.
     * @param {Annotation} annotation A data representation of the annotation.
     * @param {CoordSystem} [coordSystem="web"] Coordinate system used by the annotation.
     * @param {boolean} [transmit=true] Any collaborators should also be
     * told to add the annotation.
     */
    function addAnnotation(annotation, coordSystem="web", transmit = true) {
        const addedAnnotation = _cloneAnnotation(annotation);

        // Check if an identical annotation already exists, remove old one if it does
        let replacedAnnotation = _findDuplicateAnnotation(addedAnnotation);
        if (replacedAnnotation) {
            console.warn("Adding an annotation with identical properties to an existing annotation, replacing.");
            updateAnnotation(replacedAnnotation.id, addedAnnotation, coordSystem, false);
            return;
        }

        // Make sure the annotation has an id
        if (addedAnnotation.id === undefined) {
            addedAnnotation.id = _generateId();
        }
        else {
            // If the id has been specified, check if it's not taken
            const existingAnnotation = getAnnotationById(addedAnnotation.id);
            if (existingAnnotation !== undefined) {
                console.info("Tried to assign an already-used id, reassigning.");
                addedAnnotation.originalId === undefined && (addedAnnotation.originalId = addedAnnotation.id);
                addedAnnotation.id = _generateId();
            }
        }

        // Store the coordinates in all systems and set the image coordinates
        const coords = addedAnnotation.points.map(point =>
            _getCoordSystems(point, coordSystem)
        )
        if (coordSystem !== "image")
            addedAnnotation.points = coords.map(coord => coord.image);

        // Set the centroid of the annotation
        if (!addedAnnotation.centroid)
            addedAnnotation.centroid = _getCentroid(addedAnnotation.points);

        // Set the author of the annotation
        if (!addedAnnotation.author)
            addedAnnotation.author = userInfo.getName();

        // Store a data representation of the annotation
        _annotations.push(addedAnnotation);

        // Send the update to collaborators
        transmit && collabClient.addAnnotation(addedAnnotation);

        // Add a graphical representation of the annotation
        annotationVisuals.update(_annotations);
    }

    /**
     * Update the parameters of an already existing annotation.
     * @param {number} id The initial id of the annotation to be updated.
     * @param {Annotation} annotation The new values for the annotation to be updated.
     * @param {CoordSystem} [coordSystem="web"] Coordinate system used by the annotation.
     * @param {boolean} [transmit=true] Any collaborators should also be
     * told to update their annotation.
     */
    function updateAnnotation(id, annotation, coordSystem="web", transmit = true) {
        const annotations = _annotations;
        const updatedIndex = annotations.findIndex(annotation => annotation.id === id);
        const updatedAnnotation = getAnnotationById(id);

        // Check if the annotation being updated exists first
        if (updatedAnnotation === undefined) {
            throw new Error("Tried to update an annotation that doesn't exist.");
        }

        // If the id is being changed, check if it's not taken
        if (annotation.id !== undefined && annotation.id !== id) {
            const existingAnnotation = getAnnotationById(annotation.id);
            if (existingAnnotation !== undefined) {
                console.info("Tried to assign an already-used id, keeping old id.");
                annotation.originalId = annotation.id;
                annotation.id = id;
            }
        }

        // Copy over the updated properties
        Object.assign(updatedAnnotation, annotation);

        // Make sure the data is stored in the image coordinate system
        const coords = updatedAnnotation.points.map(point =>
            _getCoordSystems(point, coordSystem)
        )
        if (coordSystem !== "image")
            updatedAnnotation.points = coords.map(coord => coord.image);

        // Set the centroid of the annotation
        updatedAnnotation.centroid = _getCentroid(updatedAnnotation.points);

        // Store the annotation in data
        Object.assign(annotations[updatedIndex], updatedAnnotation);

        // Send the update to collaborators
        transmit && collabClient.updateAnnotation(id, updatedAnnotation);

        // Update the annotation in the graphics
        annotationVisuals.update(_annotations);
    }

    /**
     * Remove an annotation from the data.
     * @param {number} id The id of the annotation to be removed.
     * @param {boolean} [transmit=true] Any collaborators should also be
     * told to remove the annotation.
     */
    function removeAnnotation(id, transmit = true) {
        const annotations = _annotations;
        const deletedIndex = annotations.findIndex(annotation => annotation.id === id);

        // Check if the annotation exists first
        if (deletedIndex === -1) {
            throw new Error("Tried to remove an annotation that doesn't exist");
        }

        // Remove the annotation from the data
        annotations.splice(deletedIndex, 1);

        // Send the update to collaborators
        transmit && collabClient.removeAnnotation(id);

        // Remove the annotation from the graphics
        annotationVisuals.update(_annotations);
    }

    /**
     * Remove all annotations from the data.
     * @param {boolean} [transmit=true] Any collaborators should also
     * be told to clear their annotations.
     */
    function clearAnnotations(transmit = true) {
        const annotations = _annotations;
        const ids = annotations.map(annotation => annotation.id);
        ids.forEach(id => removeAnnotation(id, false));

        // Send the update to collaborators
        transmit && collabClient.clearAnnotations();

        // Clear the overlay
        annotationVisuals.clear();
    }

    /**
     * Iterate a function for each annotation. The function will not change
     * the values of the annotation, and will instead work on clones of them,
     * effectively making them read-only. If the annotation values should be
     * updated, updateAnnotation() can be run in the passed function.
     * @param {function} f Function to be called with each annotation.
     */
    function forEachAnnotation(f) {
        _annotations.map(_cloneAnnotation).forEach(f);
    }

    /**
     * Get a copy of a specified annotation by its id.
     * @param {number} id The id used for looking up the annotation.
     * @returns {Object} A clone of the annotation with the specified id,
     * or undefined if not in use.
     */
    function getAnnotationById(id) {
        const annotation = _annotations.find(annotation => annotation.id === id);
        if (annotation === undefined) {
            return undefined;
        }
        const annotationClone = _cloneAnnotation(annotation);
        return annotationClone;
    }

    /**
     * Check whether or not the list of annotations is empty.
     * @returns {boolean} Whether or not the list is empty.
     */
    function empty() {
        return _annotations.length === 0;
    }

    // Return public members of the closure
    return {
        addAnnotation: addAnnotation,
        updateAnnotation: updateAnnotation,
        removeAnnotation: removeAnnotation,
        clearAnnotations: clearAnnotations,
        forEachAnnotation: forEachAnnotation,
        getAnnotationById: getAnnotationById,
        empty: empty
    };
})();

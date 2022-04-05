/**
 * Namespace for handling annotations. Deals with both the data
 * representation of the annotations and the graphical representation. All
 * manipulation of the annotations should go through this namespace's
 * functions to ensure that all necessary steps are performed.
 * @namespace annotationHandler
 */
const annotationHandler = (function (){
    "use strict";

    const timingLog=false; //Log add/update times

    /**
     * Data representation of an annotation that should be used when adding or
     * updating information about it. While all annotations that have already
     * been added will have an id property, it can optionally be included
     * when adding information about the annotation to force an id. The
     * same applies to the centroid of the annotation.
     * @typedef {Object} Annotation
     * @property {Array<Object>} points The x and y positions of each
     * point in the annotation; a single point if marker, multiple
     * if region.
     * @property {number} z Z value when the annotation was placed.
     * @property {string} mclass Class name of the annotation.
     * @property {Object} centroid The centroid of the annotated point
     * or region.
     * @property {Object} diameter The diameter of the annotation
     * @property {boolean} [bookmarked] Whether or not the annotation has
     * been bookmarked.
     * @property {Array} [comments] Comments associated with the annotation.
     * @property {string} [author] The name of the person who originally
     * placed the annotation.
     * @property {number} [id] Hard-coded ID of the annotation.
     * @property {number} [originalId] Original ID of annotation, that
     * may have had to be changed if the annotation was added when the
     * id was already in use.
     * @property {number} [prediction] Optional prediction score indicating
     * cancer probability.
     */
    /**
     * Representation of the OpenSeadragon coordinate system used to
     * represent a point. Should take on the values of "web", "viewport"
     * or "image". See more information about the different coordinate
     * systems {@link https://openseadragon.github.io/examples/viewport-coordinates/|here.}
     * @typedef {string} CoordSystem
     */
    const _annotations = [];
    let _nMarkers = 0;
    let _nRegions = 0;
    let _classCounts = {};
    classUtils.forEachClass(c => _classCounts[c.name] = 0);

    function _updateAnnotationCounts() {
        globalDataHandler.updateAnnotationCounts(_nMarkers, _nRegions, _classCounts);
    }

    function _restartAnnotationCounts() {
        _nMarkers = 0;
        _nRegions = 0;
        _classCounts = {};
        classUtils.forEachClass(c => _classCounts[c.name] = 0);
        globalDataHandler.updateAnnotationCounts(_nMarkers, _nRegions, _classCounts);
    }

    // Low-res array of arrays
    const _annotationGrid = []; 
    const _gridShift = 10; //2^n sized grid squares
    const _gridMax = 20-_gridShift; //at most (2^n)^2 grid squares
    // Add to _annotations and to _annotationGrid
    function _getGridIdx(annotation) {
        if (!annotation.points || !annotation.points.length) {
            console.error('Annotation without points[0]');
            return 0;
        }
        const p=annotation.points[0];
        if ((p.x>>_gridShift)>>_gridMax) {
            error('Too large image, increase _gridMax'); 
        }
        return (p.y>>_gridShift)<<_gridMax | (p.x>>_gridShift);
    }
    function _addAnnotation(annotation) {
        const idx=_annotations.push(annotation);
        _addGridAnnotation(annotation);
        return idx;
    }
    function _addGridAnnotation(annotation) {
        const grid=_getGridIdx(annotation);
        _annotationGrid[grid] ?? (_annotationGrid[grid]=[]); //allow node<15.x
        _annotationGrid[grid].push(annotation);
    }
    //array of annotations in grid (not to be written to)
    function _getGridAnnotations(annotation) {
        const grid=_getGridIdx(annotation);
        return _annotationGrid[grid] ?? [];
    }
    function _removeGridAnnotation(annotation) {
        const grid = _getGridAnnotations(annotation);
        const gridIndex = grid.findIndex(x => x.id === annotation.id);
        grid.splice(gridIndex,1);
    }

    function _generateId() {
        const order = Math.ceil(Math.log10((1 + _annotations.length) * 100));
        const multiplier = Math.pow(10, order);
        let id;
        do {
            let seed = Math.random();
            id = Math.round(multiplier * seed);
        } while(getAnnotationById(id) !== undefined);
        return id;
    }

    function _cloneAnnotation(annotation, include_computables=true) {
        // A deep clone could also be done with jQuery.extend(true, {}, annotation)
        // But this explicit clone was over 10 times faster when tested
        // Make sure to remember to update it if fields are changed
        const clone = {
            points: annotation.points && annotation.points.map(point => {
                return {
                    x: point.x,
                    y: point.y
                };
            }),
            z: annotation.z,
            mclass: annotation.mclass,
            
            comments: annotation.comments && annotation.comments.map(comment => {
                return {
                    author: comment.author,
                    body: comment.body
                };
            }),
            author: annotation.author,
            id: annotation.id,
            originalId: annotation.originalId
        };

        if (include_computables) { //and defaults
            Object.assign(clone,{                
                bookmarked: annotation.bookmarked,
                prediction: annotation.prediction,
                centroid: annotation.centroid && {x: annotation.centroid.x, y: annotation.centroid.y},
                diameter: annotation.diameter
            });
        }
        else { //include if non-default valued
            annotation.bookmarked && Object.assign(clone,{bookmarked: annotation.bookmarked});
            annotation.prediction!=null && Object.assign(clone,{prediction: annotation.prediction});
        }
        return clone;
    }

    // true if same geometry
    function _pointsAreDuplicate(pointsA, pointsB) {
        if (pointsA.length !== pointsB.length)
            return false;

        return pointsA.every((pointA, index) => {
            const pointB = pointsB[index];
            return pointA.x === pointB.x && pointA.y === pointB.y;
        });
    }

    // true if annotation with same geometry already stored
    function _findDuplicateAnnotation(annotation) {
        return _getGridAnnotations(annotation).find(existingAnnotation =>
            existingAnnotation.z === annotation.z
            && existingAnnotation.mclass === annotation.mclass
            && _pointsAreDuplicate(annotation.points, existingAnnotation.points)
        );
    }

    function _updateVisuals() {
        annotationVisuals.update(_annotations);
    }

    /**
     * Get an object with a given point's location expressed in all OSD
     * coordinate systems.
     * @param {Object} point The point to check.
     * @param {number} point.x The x coordinate of the point.
     * @param {number} point.y The y coordinate of the point.
     * @param {CoordSystem} coordSystem The coordinate system the point
     * is originally expressed with.
     * @returns {Object} An object with the properties "web", "viewport"
     * and "image" that describe the point in each coordinate system.
     */
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
     * Generates a single prediction score
     * @returns {Object} null
     */
    function _generatePrediction() {
        return null
    }

    /**
     * Add a single annotation to the data.
     * @param {Annotation|Array<Annotation>} annotations A data representation of the annotation.
     * @param {CoordSystem} [coordSystem="web"] Coordinate system used by the annotation.
     * @param {boolean} [transmit=true] Any collaborators should also be
     * told to add the annotation.
     */
    function add(annotations, coordSystem="web", transmit = true) {
        let once=false;
        if (!Array.isArray(annotations)) {
            annotations = [annotations];
        }

        console.log(`Adding ${annotations.length} annotations...`);
        timingLog && console.time('addAnnotation');

        let classes = classUtils.getSortedNames(classUtils.getClassConfig());

        annotations.forEach(annotation => {
            const addedAnnotation = _cloneAnnotation(annotation);

            // Store the coordinates in all systems and set the image coordinates
            const coords = addedAnnotation.points.map(point =>
                _getCoordSystems(point, coordSystem)
            );
            if (coordSystem !== "image")
                addedAnnotation.points = coords.map(coord => coord.image);
            if (!addedAnnotation.points.every(coordinateHelper.pointIsInsideImage)) {
                console.warn("Cannot add an annotation with points outside the image.");
                return;
            }

            if (!(classes.includes(addedAnnotation.mclass))) {
                console.warn("Cannot add an annotation with unrecognised/incompatible class.");
                return;
            }

            // Check if an identical annotation already exists, remove old one if it does
            let replacedAnnotation = _findDuplicateAnnotation(addedAnnotation);
            if (replacedAnnotation) {
                // old node does not like ||=
                once || (console.warn("Adding annotation(s) with identical properties as existing one, replacing."), once=true);
                update(replacedAnnotation.id, addedAnnotation, coordSystem, false, false);
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

            // Set the bookmark field of the annotation
            if (addedAnnotation.bookmarked === undefined)
                addedAnnotation.bookmarked = false;

            // Set the centroid of the annotation
            if (!addedAnnotation.centroid)
                addedAnnotation.centroid = mathUtils.getCentroid(addedAnnotation.points);

            // Set the diameter of the annotation
            if (!addedAnnotation.diameter)
                addedAnnotation.diameter = mathUtils.getDiameter(addedAnnotation.points);

            // Set the author of the annotation
            if (!addedAnnotation.author)
                addedAnnotation.author = userInfo.getName();
            
            // Set the prediction score
            if (addedAnnotation.prediction === undefined)
                addedAnnotation.prediction = _generatePrediction();

            // Store a data representation of the annotation
            _addAnnotation(addedAnnotation);

            // Update the annotation count
            if (addedAnnotation.points.length === 1) {
                _nMarkers++;
            }
            else {
                _nRegions++;
            }
            _classCounts[addedAnnotation.mclass]++;

            // Send the update to collaborators
            transmit && collabClient.addAnnotation(addedAnnotation);
        });

        _updateAnnotationCounts();
        timingLog && console.timeEnd('addAnnotation');

        // Add a graphical representation of the annotation
        _updateVisuals();
    }

    /**
     * Update the parameters of an already existing annotation.
     * @param {number} id The initial id of the annotation to be updated.
     * @param {Annotation} annotation The new values for the annotation to be updated.
     * @param {CoordSystem} [coordSystem="web"] Coordinate system used by the annotation.
     * @param {boolean} [transmit=true] Any collaborators should also be
     * told to update their annotation.
     */
    function update(id, annotation, coordSystem="web", transmit = true, redraw = true) {
        timingLog && console.time('updateAnnotation');
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


        // Make sure the data is stored in the image coordinate system
        const coords = updatedAnnotation.points.map(point =>
            _getCoordSystems(point, coordSystem)
        );
        if (coordSystem !== "image")
            updatedAnnotation.points = coords.map(coord => coord.image);

        // Keep the annotation inside the image
        if (annotation.points && !annotation.points.every(coordinateHelper.pointIsInsideImage)) {
            console.warn("Cannot move an annotation outside the image.");
            return;
        }

        // Don't edit a region to intersect itself
        if (mathUtils.pathIntersectsSelf(annotation.points)) {
            console.warn("Cannot make a region intersect itself.");
            return;
        }

        // Update annotation count
        if (annotation.mclass !== undefined && annotation.mclass !== updatedAnnotation.mclass) {
            _classCounts[updatedAnnotation.mclass]--;
            _classCounts[annotation.mclass]++;
            _updateAnnotationCounts();
        }

        // Check if changing grid square
        const oldGridIndex = _getGridIdx(updatedAnnotation);      

        // Copy over the updated properties
        Object.assign(updatedAnnotation, annotation);
        const newGridIndex = _getGridIdx(updatedAnnotation);

        // Set the centroid of the annotation
        updatedAnnotation.centroid = mathUtils.getCentroid(updatedAnnotation.points);

        // Set the diameter of the annotation
        updatedAnnotation.diameter = mathUtils.getDiameter(updatedAnnotation.points);


        // Store the annotation in data
        const updatedIndex = _annotations.findIndex(annotationx => annotationx.id === id);

        if (newGridIndex !== oldGridIndex) {
            // console.log(`Moving from idx ${oldGridIndex} to ${newGridIndex}`);
            _removeGridAnnotation(_annotations[updatedIndex]);
        }

        Object.assign(_annotations[updatedIndex], updatedAnnotation);

        if (newGridIndex !== oldGridIndex) {
            _addGridAnnotation(_annotations[updatedIndex]);
        }


        // Send the update to collaborators
        transmit && collabClient.updateAnnotation(id, updatedAnnotation);


        // Update the annotation in the graphics
        redraw && _updateVisuals();
        timingLog && console.timeEnd('updateAnnotation');
    }

    /**
     * Set the bookmark state of a given annotation.
     * @param {number} id The id of the annotation to set the bookmark state of.
     * @param {boolean} [state] The bookmark state to set the annotation
     * to. If left undefined, the bookmark state will be changed to whichever
     * value it does not currently have.
     * @returns {boolean} Whether or not the annotation is now bookmarked.
     */
    function setBookmarked(id, state) {
        const annotation = getAnnotationById(id);
        if (annotation) {
            if (state === undefined) {
                annotation.bookmarked = !annotation.bookmarked;
            }
            else {
                annotation.bookmarked = state;
            }
            update(id, annotation, "image");
            return annotation.bookmarked;
        }
        else {
            throw new Error("Tried to bookmark an annotation that doesn't exist.");
        }
    }

    /**
     * Remove an annotation from the data.
     * @param {number|Array<number>} ids The id of the annotation to be removed.
     * @param {boolean} [transmit=true] Any collaborators should also be
     * told to remove the annotation.
     */
    function remove(ids, transmit = true) {
        if (!Array.isArray(ids)) {
            ids = [ids];
        }
        ids.forEach(id => {
            const annotations = _annotations;
            const deletedIndex = annotations.findIndex(annotation => annotation.id === id);

            // Check if the annotation exists first
            if (deletedIndex === -1) {
                throw new Error("Tried to remove an annotation that doesn't exist");
            }

            // Remove the annotation from the data
            const removedAnnotation = annotations.splice(deletedIndex, 1)[0];

            // Remove from gridded
            _removeGridAnnotation(removedAnnotation);

            // Update the annotation count
            if (removedAnnotation.points.length === 1) {
                _nMarkers--;
            }
            else {
                _nRegions--;
            }
            _classCounts[removedAnnotation.mclass]--;

            // Send the update to collaborators
            transmit && collabClient.removeAnnotation(id);
            regionEditor.stopEditingRegionIfBeingEdited(id);
        });

        _updateAnnotationCounts();

        // Remove the annotation from the graphics
        _updateVisuals();
    }

    /**
     * Remove all annotations from the data.
     * @param {boolean} [transmit=true] Any collaborators should also
     * be told to clear their annotations.
     */
    function clear(transmit = true) {
        const annotations = _annotations;
        const ids = annotations.map(annotation => annotation.id);
        remove(ids, false);

        // Send the update to collaborators
        transmit && collabClient.clearAnnotations();

        // Clear the overlay
        annotationVisuals.clear();
    }

    /**
     * Iterate a function for each annotation. The function will not change
     * the values of the annotation, and will instead work on clones of them,
     * effectively making them read-only. If the annotation values should be
     * updated, update() can be run in the passed function.
     * @param {function} f Function to be called with each annotation.
     */
    function forEachAnnotation(f, include_computable=true) {
        _annotations.map((elem) => _cloneAnnotation(elem,include_computable)).forEach(f);
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
    function isEmpty() {
        return _annotations.length === 0;
    }

    /**
     * Call private function to restart annotation counts.
     */
    function updateClassConfig(classConfig, transmit = true) {
        _restartAnnotationCounts();

        // Send the update to collaborators
        transmit && collabClient.updateClassConfig(classConfig);
    }

    // Return public members of the closure
    return {
        add,
        update,
        setBookmarked,
        remove,
        clear,
        forEachAnnotation,
        getAnnotationById,
        isEmpty,
        updateClassConfig
    };
})();

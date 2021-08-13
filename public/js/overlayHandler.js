/**
 * Functions for updating the OpenSeadragon overlay.
 * @namespace overlayHandler
 **/
const overlayHandler = (function (){
    "use strict";

    const _markerSquareSize = 1/8,
        _markerCircleSize = 1/32,
        _markerSquareStrokeWidth = 0.02,
        _markerCircleStrokeWidth = 0.01,
        _scaleFloor = 0.25, // _scaleFloor * maxZoom = lowest zoom level where markers have a constant size on screen
        _markerText = true;

    let _cursorOverlay,
        _markerOverlay,
        _regionOverlay,
        _pendingRegionOverlay,
        _activeAnnotationOverlayName,
        _previousCursors,
        _scale,
        _maxScale,
        _rotation;

    /**
     * Edit a string with stored in the transform attribute of a node.
     * This function only edits properties already stored in the string,
     * it does not add any. This is because of the fact that the order of
     * transform properties changes the final result. If a property is not
     * specified by the changes argument, it retains its old value.
     * @param {string} transformString The original transform string.
     * @param {Object} changes Key-value pairs of transforms and their
     * changed properties. The keys are the names of the transforms, and
     * the values can either be numbers, Arrays, or Functions. Numbers
     * and Arrays simply assign new values to the transforms. Functions
     * are run on the old values to produce new values.
     * @returns {string} The resulting transform string.
     */
    function _editTransform(transformString, changes) {
        // Turn the transform string into an object
        // Start by finding all the transforms
        const transforms = transformString.match(/[^\s,]+\([^)]*\)/g);
        // Structure the transform as an object
        const transObj = {};
        const names = transforms.map(transform => transform.match(/.+(?=\()/g)[0]);
        transforms.forEach(transform => {
            const name = transform.match(/.+(?=\()/g);
            const values = transform.match(/(?<=\(.*)[^\s,]+(?=.*\))/g);
            transObj[name] = values;
        });

        // Assign the changes
        let result = "";
        names.forEach(name => {
            const value = changes[name];
            if (value !== undefined) {
                if (Array.isArray(value)) {
                    transObj[name] = value;
                }
                else if (typeof value === "function") {
                    transObj[name] = transObj[name].map(value);
                }
                else if (typeof value !== "object") {
                    transObj[name] = [value];
                }
                else {
                    throw new Error("Invalid transform change.");
                }
            }
            result += `${name}(${transObj[name].toString()}) `;
        });

        return result;
    }

    /**
     * Convenience function for creating a function that can be run
     * to edit transforms with d3.
     * @param {Object} transform The transform that should be applied
     * with the returned function.
     */
    function _transformFunction(transform) {
        function f(d, i) {
            let appliedTransform;
            if (typeof transform === "function") {
                appliedTransform = transform.call(this, d, i);
            }
            else {
                appliedTransform = transform;
            }
            const currTransform = this.getAttribute("transform");
            return _editTransform(currTransform, appliedTransform);
        }
        return f;
    }

    function _cursorSize(cursor) {
        const normalSize = cursor.inside || cursor.held;
        return (normalSize ? 15 : 12) * _scale;
    }

    function _markerSize() {
        return 100 * Math.min(_scale, _maxScale);
    }

    function _regionStrokeWidth() {
        return 2 * _scale;
    }

    function _regionHandleSize() {
        return 0.5 * _scale;
    }

    function _getRegionPath(d) {
        const stops = d.points.map(point => {
            const viewport = coordinateHelper.imageToViewport(point);
            const coords = coordinateHelper.viewportToOverlay(viewport);
            return `${coords.x} ${coords.y}`;
        });
        return `M ${stops.join(" L ")} Z`;
    }

    function _getAnnotationColor(d) {
        return classUtils.classColor(d.mclass);
    }

    function _getAnnotationText(d) {
        return `#${d.id}: ${d.mclass}`;
    }

    function _resizeMembers() {
        _cursorOverlay.selectAll("g")
            .attr("transform", _transformFunction(function() {
                return {scale: _cursorSize(_previousCursors.get(this))};
            }));
    }

    function _resizeMarkers() {
        _markerOverlay.selectAll("g")
            .attr("transform", _transformFunction({scale: _markerSize()}));
    }

    function _resizeRegions() {
        _regionOverlay.selectAll("g")
            .call(group =>
                group.select(".region-area")
                    .attr("stroke-width", _regionStrokeWidth())
            )
            .selectAll(".region-edit-handles g")
            .attr("transform", _transformFunction({scale: _regionHandleSize()}));
        _pendingRegionOverlay.selectAll("path")
            .attr("stroke-width", _regionStrokeWidth())
            .attr("stroke-dasharray", _regionStrokeWidth());
    }

    function _rotateMarkers() {
        _markerOverlay.selectAll("g")
            .attr("transform", _transformFunction({rotate: -_rotation}));
    }

    function _toggleRegionEditControls(d, node) {
        const selection = d3.select(node);
        if (selection.attr("data-being-edited")) {
            selection.selectAll(".region-edit-handles g path")
                .transition("appear").duration(250)
                .attr("transform", "scale(0)")
                .on("end", () =>
                    selection.attr("data-being-edited", null)
                        .select(".region-edit-handles")
                        .remove()
                );
        }
        else {
            selection.attr("data-being-edited", true)
                .append("g")
                .attr("class", "region-edit-handles")
                .call(group => {
                    d.points.forEach(point => {
                        group.append("g")
                            .attr("transform", d => {
                                const viewport = coordinateHelper.imageToViewport(point);
                                const coords = coordinateHelper.viewportToOverlay(viewport);
                                return `translate(${coords.x}, ${coords.y}), scale(${_regionHandleSize()})`;
                            })
                            .append("path")
                            .attr("d", d3.symbol().size(500).type(d3.symbolCircle))
                            .attr("transform", "scale(0)")
                            .style("fill", _getAnnotationColor)
                            .style("cursor", "move")
                            .transition("appear").duration(250)
                            .attr("transform", "scale(1)")
                            .call(path => {
                                new OpenSeadragon.MouseTracker({
                                    element: path.node(),
                                    dragHandler: function(event) {
                                        const reference = coordinateHelper.webToImage({x: 0, y: 0});
                                        const delta = coordinateHelper.webToImage(event.delta);
                                        point.x += delta.x - reference.x;
                                        point.y += delta.y - reference.y;
                                        annotationHandler.update(d.id, d, "image");
                                        const viewportCoords = coordinateHelper.pageToViewport({
                                            x: event.originalEvent.pageX,
                                            y: event.originalEvent.pageY
                                        });
                                        tmapp.setCursorStatus(viewportCoords);
                                    }
                                }).setTracking(true);
                            });
                    });
                });
        }
    }

    /**
     * Add mouse events that should be shared between all annotations,
     * both markers and regions. These include handlers for dragging an
     * annotation, ctrl-clicking to remove, and right clicking for
     * options.
     * @param {Object} d The data object given by d3.
     * @param {Object} node The node for the annotation.
     */
    function _addAnnotationMouseEvents(d, node) {
        new OpenSeadragon.MouseTracker({
            element: node,
            clickHandler: function(event) {
                if (event.originalEvent.ctrlKey) {
                    annotationHandler.remove(d.id);
                }
            },
            pressHandler: function(event) {
                tmapp.setCursorStatus({held: true});
            },
            releaseHandler: function(event) {
                tmapp.setCursorStatus({held: false});
            },
            dragHandler: function(event) {
                const reference = coordinateHelper.webToImage({x: 0, y: 0});
                const delta = coordinateHelper.webToImage(event.delta);
                d.points.forEach(point => {
                    point.x += delta.x - reference.x;
                    point.y += delta.y - reference.y;
                });
                annotationHandler.update(d.id, d, "image");
                const viewportCoords = coordinateHelper.pageToViewport({
                    x: event.originalEvent.pageX,
                    y: event.originalEvent.pageY
                });
                tmapp.setCursorStatus(viewportCoords);
            },
            nonPrimaryReleaseHandler: function(event) {
                if (event.button === 2) { // If right click
                    const location = {
                        x: event.originalEvent.pageX,
                        y: event.originalEvent.pageY
                    };
                    tmappUI.openAnnotationEditMenu(d.id, location);
                }
            }
        }).setTracking(true);
    }

    function _addMarkerMouseEvents(d, node) {
        _addAnnotationMouseEvents(d, node);

        function highlight() {
            d3.select(node)
                .selectAll("path")
                .filter((d, i) => i === 0)
                .transition("highlight").duration(200)
                .attr("transform", _transformFunction({
                    scale: 1.25,
                    rotate: 45
                }))
                .attr("stroke", _getAnnotationColor);
            d3.select(node)
                .selectAll("text")
                .transition("highlight").duration(200)
                .style("opacity", 1);
        }

        function unHighlight() {
            d3.select(node)
                .selectAll("path")
                .filter((d, i) => i === 0)
                .transition("highlight").duration(200)
                .attr("transform", _transformFunction({
                    scale: 1.0,
                    rotate: 45
                }))
                .attr("stroke", _getAnnotationColor);
            d3.select(node)
                .selectAll("text")
                .transition("highlight").duration(200)
                .style("opacity", 0);
        }

        new OpenSeadragon.MouseTracker({
            element: node,
            enterHandler: highlight,
            exitHandler: unHighlight
        }).setTracking(true);
    }

    function _addRegionMouseEvents(d, node) {
        _addAnnotationMouseEvents(d, node);

        function highlight() {
            d3.select(node)
                .selectAll(".region-area")
                .transition("highlight").duration(200)
                .attr("stroke", _getAnnotationColor)
                .attr("fill", _getAnnotationColor)
                .attr("fill-opacity", 0.4);
        }

        function unHighlight() {
            d3.select(node)
                .selectAll(".region-area")
                .transition("highlight").duration(200)
                .attr("stroke", _getAnnotationColor)
                .attr("fill", _getAnnotationColor)
                .attr("fill-opacity", 0.2);
        }

        function beginEditing() {
            _toggleRegionEditControls(d, node);
        }

        new OpenSeadragon.MouseTracker({
            element: node,
            enterHandler: highlight,
            exitHandler: unHighlight,
            dblClickHandler: beginEditing
        }).setTracking(true);
    }

    function _enterMarker(enter) {
        enter.append("g")
            .attr("transform", d => {
                const viewport = coordinateHelper.imageToViewport(d.points[0]);
                const coords = coordinateHelper.viewportToOverlay(viewport);
                return `translate(${coords.x}, ${coords.y}) scale(${_markerSize()}) rotate(${-_rotation})`;
            })
            .attr("opacity", 1)
            .call(group =>
                group.append("path")
                    .attr("d", d3.symbol().size(_markerSquareSize).type(d3.symbolSquare))
                    .attr("transform", "rotate(0) scale(0)")
                    .attr("stroke-width", _markerSquareStrokeWidth)
                    .attr("stroke", _getAnnotationColor)
                    .style("fill","rgba(0,0,0,0.2)")
                    .transition("appear").duration(250)
                    .attr("transform", _transformFunction({
                        rotate: 45,
                        scale: 1
                    }))
                    .on("end", () =>
                        group.each(function(d) {
                            _addMarkerMouseEvents(d, this);
                        })
                    )
            )
            .call(group =>
                group.append("path")
                    .attr("d", d3.symbol().size(_markerCircleSize).type(d3.symbolCircle))
                    .attr("transform", "scale(0)")
                    .attr("stroke-width", _markerCircleStrokeWidth)
                    .attr("stroke", "gray")
                    .style("fill", "transparent")
                    .style("pointer-events", "none")
                    .transition("appear").delay(150).duration(100)
                    .attr("transform", _transformFunction({
                        scale: 1
                    }))
            )
            .call(group => {
                if (_markerText) {
                    group.append("text")
                        .style("fill", _getAnnotationColor)
                        .style("font-size", "1%")
                        .style("font-weight", "700")
                        .style("pointer-events", "none")
                        .style("opacity", 0)
                        .attr("text-anchor", "left")
                        .attr("transform", "translate(0.2, -0.2)")
                        .text(_getAnnotationText);
                    }
                }
            );
    }

    function _updateMarker(update) {
        update.attr("transform", _transformFunction(function(d) {
                const viewport = coordinateHelper.imageToViewport(d.points[0]);
                const coords = coordinateHelper.viewportToOverlay(viewport);
                return {translate: [coords.x, coords.y]};
            }))
            .selectAll("path")
            .filter((d, i) => i === 0)
            .transition("changeColor").duration(500)
            .attr("stroke", _getAnnotationColor);
        if (_markerText) {
            update.select("text")
                .style("fill", _getAnnotationColor)
                .text(_getAnnotationText);
        }
    }

    function _exitMarker(exit) {
        exit.transition("appear").duration(200)
            .attr("opacity", 0)
            .attr("transform", _transformFunction({
                scale: s => 2 * s
            }))
            .remove();
    }

    function _enterRegion(enter) {
        enter.append("g")
            .attr("class", "region")
            .call(group =>
                group.append("path")
                    .attr("d", _getRegionPath)
                    .attr("stroke", _getAnnotationColor)
                    .attr("stroke-width", _regionStrokeWidth())
                    .attr("fill", _getAnnotationColor)
                    .attr("fill-opacity", 0.2)
                    .attr("class", "region-area")
            )
            .attr("opacity", 1)
            .each(function(d) {_addRegionMouseEvents(d, this);});
    }

    function _updateRegion(update) {
        update.call(update =>
                update.select(".region-area")
                    .attr("d", _getRegionPath)
                    .transition("changeColor").duration(500)
                    .attr("stroke", _getAnnotationColor)
                    .attr("fill", _getAnnotationColor)
            )
            .call(update =>
                update.selectAll(".region-edit-handles g")
                    .each(function(d, i) {
                        const point = d.points[i];
                        d3.select(this)
                            .attr("transform", _transformFunction(function(d) {
                                const viewport = coordinateHelper.imageToViewport(point);
                                const coords = coordinateHelper.viewportToOverlay(viewport);
                                return {translate: [coords.x, coords.y]};
                            }));
                    })
                    .transition("changeColor").duration(500)
                    .style("fill", _getAnnotationColor)
            );
    }

    function _exitRegion(exit) {
        exit.transition("appear").duration(200)
            .attr("opacity", 0)
            .remove();
    }

    function _enterMember(enter) {
        const group = enter.append("g")
            .attr("transform", d => {
                const coords = coordinateHelper.viewportToOverlay(d.cursor);
                return `translate(${coords.x}, ${coords.y}), rotate(-30), scale(${_cursorSize(d.cursor)})`
            })
            .attr("opacity", 0.0)
            .style("fill", d => d.color)
            .call(group =>
                group.append("path")
                    .attr("d", "M 0 0 L -0.4 1.0 L 0 0.7 L 0.4 1.0 Z")
                    .attr("class", "pointer")
            )
            .call(group =>
                group.append("path")
                    .attr("d", "M -0.4 1.0 L -0.36 1.2 L 0.36 1.2 L 0.4 1.0 L 0 0.7 Z")
                    .attr("class", "caret")
                    .transition("appear").duration(500)
                    .attr("transform", "translate(0, 0.15)")
            )
            .transition("appear").duration(100)
            .attr("opacity", 1.0);
    }

    function _updateMember(update) {
        update.attr("transform", _transformFunction(function(d) {
                const coords = coordinateHelper.viewportToOverlay(d.cursor);
                return {translate: [coords.x, coords.y]};
            }))
            .call(group =>
                group.filter(function(d) {return _previousCursors.get(this).inside !== d.cursor.inside;})
                    .transition("changeColor").duration(500)
                    .style("opacity", d => d.cursor.inside ? 1.0 : 0.2)
            )
            .select(".caret")
            .filter(function(d) {
                return _previousCursors.get(this).held !== d.cursor.held;
            })
            .transition("highlight").duration(150)
            .attr("transform", d => `translate(0, ${d.cursor.held ? 0.05 : 0.15})`);
    }

    /**
     * Use d3 to update the collaboration cursors, adding new ones and
     * removing old ones.
     * @param {Array} nonLocalMembers An array of members, excluding the
     * local member.
     */
    function updateMembers(nonLocalMembers) {
        if (!_cursorOverlay) {
            return;
        }

        const visibleMembers = nonLocalMembers.filter(member => {
            return member.cursor;
        });

        _cursorOverlay.selectAll("g")
            .data(visibleMembers, d => d.id)
            .join(
                _enterMember,
                _updateMember
            );

        _cursorOverlay.selectAll("g")
            .property(_previousCursors, d => d.cursor);
    }

    /**
     * Clear all annotations currently in the overlay, in case you need to quickly replace them.
     */
    function clearAnnotations(){
        if (_markerOverlay)
            _markerOverlay.selectAll("g").remove();
        if (_regionOverlay)
            _regionOverlay.selectAll("g").remove();
    }


    /**
     * Use d3 to update annotations, adding new ones and removing old ones.
     * The annotations are identified by their id.
     * @param {Array} annotations The currently placed annotations.
     */
    function updateAnnotations(annotations){
        const markers = annotations.filter(annotation =>
            annotation.points.length === 1
        );
        const regions = annotations.filter(annotation =>
            annotation.points.length > 1
        );

        _markerOverlay.selectAll("g")
            .data(markers, d => d.id)
            .join(
                _enterMarker,
                _updateMarker,
                _exitMarker
            );
        _regionOverlay.selectAll(".region")
            .data(regions, d => d.id)
            .join(
                _enterRegion,
                _updateRegion,
                _exitRegion
            );
    }

    /**
     * Update the visuals for the pending region.
     * @param {Object} annotation The current state of the pending region,
     * expressed in image coordinates.
     */
    function updatePendingRegion(annotation) {
        let data = [];
        if (annotation)
            data = [annotation];
        _pendingRegionOverlay.selectAll("path")
            .data(data)
            .join(
                enter => enter.append("path")
                    .attr("d", _getRegionPath)
                    .attr("stroke", _getAnnotationColor)
                    .attr("stroke-width", _regionStrokeWidth())
                    .attr("stroke-dasharray", _regionStrokeWidth())
                    .attr("fill", _getAnnotationColor)
                    .attr("fill-opacity", 0.05),
                update => update.attr("d", _getRegionPath)
                    .attr("stroke", _getAnnotationColor)
                    .attr("fill", _getAnnotationColor)
            );
    }

    /**
     * Let the overlay handler know the current zoom level and maximum
     * zoom level of the viewer in order to properly scale elements.
     * @param {number} zoomLevel The current zoom level of the OSD viewport.
     * @param {number} wContainer The maximum zoom level of the OSD viewport.
     */
    function setOverlayScale(zoomLevel, maxZoom, wContainer, hContainer) {
        const windowSizeAdjustment = 1400 / wContainer;
        _scale = windowSizeAdjustment / zoomLevel;
        _maxScale = windowSizeAdjustment / (_scaleFloor * maxZoom);
        _resizeMembers();
        _resizeMarkers();
        _resizeRegions();
    }

    /**
     * Let the overlay handler know the rotation of the viewport in order
     * to properly adjust any elements that need to be rotated.
     * @param {number} rotation The current rotation of the OSD viewport.
     */
    function setOverlayRotation(rotation) {
        _rotation = rotation;
        _rotateMarkers();
    }

    /**
     * Set which annotation overlay should be able to receive mouse
     * events at the current time.
     * @param {string} name The name of the overlay, either "region" or
     * "marker".
     */
    function setActiveAnnotationOverlay(name) {
        _activeAnnotationOverlayName = name;
        if (!_regionOverlay || !_markerOverlay)
            return;

        switch (name) {
            case "region":
                _regionOverlay.style("pointer-events", "fill")
                    .transition("highlight").duration(500)
                    .style("opacity", 1);
                _markerOverlay.style("pointer-events", "none")
                    .transition("highlight").duration(500)
                    .style("opacity", 0.4);
                break;
            case "marker":
                _regionOverlay.style("pointer-events", "none")
                    .transition("highlight").duration(500)
                    .style("opacity", 0.4);
                _markerOverlay.style("pointer-events", "fill")
                    .transition("highlight").duration(500)
                    .style("opacity", 1);
                break;
            default:
                throw new Error("Invalid overlay name.");
        }
    }

    /**
     * Initialize the overlay handler. Should be called whenever OSD is
     * initialized.
     * @param {Object} svgOverlay The return value of the OSD instance's
     * svgOverlay() method.
     */
    function init(svgOverlay) {
        const regions = d3.select(svgOverlay.node())
            .append("g")
            .attr("id", "regions");
        const pendingRegion = d3.select(svgOverlay.node())
            .append("g")
            .attr("id", "regions")
            .style("pointer-events", "none");
        const markers = d3.select(svgOverlay.node())
            .append("g")
            .attr("id", "markers");
        const cursors = d3.select(svgOverlay.node())
            .append("g")
            .attr("id", "cursors");
        _regionOverlay = d3.select(regions.node());
        _pendingRegionOverlay = d3.select(pendingRegion.node());
        _markerOverlay = d3.select(markers.node());
        _cursorOverlay = d3.select(cursors.node());
        _previousCursors = d3.local();
        if (_activeAnnotationOverlayName)
            setActiveAnnotationOverlay(_activeAnnotationOverlayName);
    }

    return {
        updateMembers: updateMembers,
        updateAnnotations: updateAnnotations,
        updatePendingRegion: updatePendingRegion,
        clearAnnotations: clearAnnotations,
        setOverlayScale: setOverlayScale,
        setOverlayRotation: setOverlayRotation,
        setActiveAnnotationOverlay: setActiveAnnotationOverlay,
        init: init
    };
})();

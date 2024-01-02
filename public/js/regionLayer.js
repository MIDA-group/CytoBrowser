/**
 * Functions for updating the region annotation overlay.
 * @namespace regionLayer
 **/

const regionLayer = (function (){
    "use strict";

    const timingLog = false; //Log update times

    let _cursorOverlay,
        _regionOverlay,
        _pendingRegionOverlay,
        _previousCursors,
        _scale,

        _svo = null, //svg overlay
        _currentMouseUpdateFun = null;

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
            const values = transform.match(/[-+]?[0-9]*\.?[0-9]+/g);
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

    function _regionStrokeWidth() {
        return 2 * _scale;
    }

    function _regionHandleSize() {
        return 0.5 * _scale;
    }

    function _getRegionPath(d) {
        const stops = d.points.map(point => {
            const coords = coordinateHelper.imageToOverlay(point);
            return `${coords.x} ${coords.y}`;
        });
        return `M ${stops.join(" L ")} Z`;
    }

    function _getAnnotationColor(d) {
        return classUtils.classColor(d.mclass);
    }

/*  Not used for Regions

    function _getAnnotationText(d) {
        if (d.prediction == null) { //null or undef
            return `${d.mclass}`;
        }
        return `${d.prediction.toFixed(4)}: ${d.mclass}`;
    }
 */
   
    function _resizeMembers() {
        _cursorOverlay.selectAll("g")
            .attr("transform", _transformFunction(function() {
                return {scale: _cursorSize(_previousCursors.get(this))};
            }));
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

    function _removeRegionEditControls(d, node) {
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
    }

    // Used when editing (path-nodes of) an existing region
    function _createRegionEditControls(d, node) {
        const selection = d3.select(node);
        if (!selection.attr("data-being-edited")) {
            selection.attr("data-being-edited", true)
                .append("g")
                .attr("class", "region-edit-handles")
                .call(group => {
                    d.points.forEach((point, i) => {
                        group.append("g")
                            .attr("transform", d => {
                                const coords = coordinateHelper.imageToOverlay(point);
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
                                let mouse_pos; //retain last used mouse_pos (global) s.t. we may update locations when keyboard panning etc.
                                let mouse_offset; //offset (in webCoords) between mouse click and vertex
                                function updateMousePos() {
                                    // Use a clone of the annotation to make sure the edit is permitted
                                    const dClone = annotationHandler.getAnnotationById(d.id);
                                    const pointClone = dClone.points[i];
                                    const vertex_new_pos = coordinateHelper.webToImage(mouse_pos.minus(mouse_offset));
                                    Object.assign(pointClone,vertex_new_pos);
                                    annotationHandler.update(d.id, dClone, "image");
                                    const viewportCoords = coordinateHelper.webToViewport(mouse_pos);
                                    tmapp.setCursorStatus(viewportCoords);
                                }
                                new OpenSeadragon.MouseTracker({
                                    element: path.node(),
                                    pressHandler: function(event) {
                                        tmapp.setCursorStatus({held: true});
                                        mouse_pos = new OpenSeadragon.Point(event.originalEvent.offsetX,event.originalEvent.offsetY);
                                        const vertex_pos = coordinateHelper.imageToWeb(annotationHandler.getAnnotationById(d.id).points[i]);
                                        mouse_offset = mouse_pos.minus(vertex_pos);
                                        _currentMouseUpdateFun=updateMousePos;
                                    },
                                    releaseHandler: function(event) {
                                        tmapp.setCursorStatus({held: false});
                                        _currentMouseUpdateFun=null;
                                    },
                                    dragHandler: function(event) {
                                        mouse_pos = new OpenSeadragon.Point(event.originalEvent.offsetX,event.originalEvent.offsetY);
                                        updateMousePos();
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
     *
     * This is for SVG version, creating a MouseTracker for each object; the PixiJS version is elsewhere.
     *
     * @param {Object} d The data object given by d3.
     * @param {Object} node The node for the annotation.
     */
    function _addAnnotationMouseEvents(d, node) {
        let mouse_pos; //retain last used mouse_pos (global) s.t. we may update locations when keyboard panning etc.
        let mouse_offset; //offset (in webCoords) between mouse click and object

        function toggleEditing(d, node) {
            const selection = d3.select(node);
            if (selection.attr("data-being-edited")) {
                regionEditor.stopEditingRegionIfBeingEdited(d.id);
            }
            else {
                regionEditor.startEditingRegion(d.id);
            }
        }
        function updateMousePos() {
            const object_new_pos = coordinateHelper.webToImage(mouse_pos.minus(mouse_offset)); //imageCoords

            // Use a clone of the annotation to make sure the edit is permitted
            const dClone = annotationHandler.getAnnotationById(d.id);
            const object_pos = dClone.centroid; //current pos imageCoords

            const delta = object_new_pos.minus(object_pos);
            dClone.points.forEach(point => {
                point.x += delta.x;
                point.y += delta.y;
            });
            annotationHandler.update(d.id, dClone, "image");

            const viewportCoords = coordinateHelper.webToViewport(mouse_pos);
            tmapp.setCursorStatus(viewportCoords);
        }
        new OpenSeadragon.MouseTracker({
            element: node,
            clickHandler: function(event) {
                regionEditor.stopEditingRegion();
                if (event.originalEvent.ctrlKey) {
                    annotationHandler.remove(d.id);
                }
                else if (layerHandler.topLayer().name==="region") {
                    const rect1 = event.eventSource.element.getBoundingClientRect(); //There must be an easier way
                    const rect2 = tmapp.mouseHandler().element.getBoundingClientRect(); //Possibly OSD 2.5 
                    event.position.x+=rect1.left-rect2.left; //https://github.com/openseadragon/openseadragon/issues/1652
                    event.position.y+=rect1.top-rect2.top;
                    tmapp.mouseHandler().clickHandler( event );
                }
            },
            dblClickHandler: function(event) { 
                // If we just created a new object in the 1st click of our dblClick, then kill it
                annotationTool.resetIfYounger(event.eventSource.dblClickTimeThreshold); 

                 if (annotationTool.isEditing()) { //If editing, allow dblClick->complete
                    const rect1 = event.eventSource.element.getBoundingClientRect();
                    const rect2 = tmapp.mouseHandler().element.getBoundingClientRect();
                    event.position.x+=rect1.left-rect2.left;
                    event.position.y+=rect1.top-rect2.top;
                    tmapp.mouseHandler().dblClickHandler( event );
                }
                else if (event.pointerType === 'touch') { // If touch
                    const location = {
                        x: event.originalEvent.pageX,
                        y: event.originalEvent.pageY
                    };
                    tmappUI.openAnnotationEditMenu(d.id, location);
                }   
                else {                    
                    toggleEditing(d, node);
                }        
            },
            pressHandler: function(event) {
                tmapp.setCursorStatus({held: true});
                mouse_pos = new OpenSeadragon.Point(event.originalEvent.offsetX,event.originalEvent.offsetY);
                const object_pos = coordinateHelper.imageToWeb(annotationHandler.getAnnotationById(d.id).centroid);
                mouse_offset = mouse_pos.minus(object_pos);
                _currentMouseUpdateFun=updateMousePos;
            },
            releaseHandler: function(event) {
                tmapp.setCursorStatus({held: false});
                _currentMouseUpdateFun=null;
            },
            dragHandler: function(event) {
                regionEditor.stopEditingRegion();
                mouse_pos = new OpenSeadragon.Point(event.originalEvent.offsetX,event.originalEvent.offsetY);
                updateMousePos();
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

        new OpenSeadragon.MouseTracker({
            element: node,
            enterHandler: highlight,
            exitHandler: unHighlight
        }).setTracking(true);
    }


    function _enterRegion(enter) {
        return enter.append("g")
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
        return update.call(update =>
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
                                const coords = coordinateHelper.imageToOverlay(point);
                                return {translate: [coords.x, coords.y]};
                            }));
                    })
                    .select("path")
                    .transition("changeColor").duration(500)
                    .style("fill", _getAnnotationColor)
            );
    }

    function _exitRegion(exit) {
        return exit.transition("appear").duration(200)
            .attr("opacity", 0)
            .remove();
    }


    function _enterMember(enter) {
        enter.append("g")
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
     * (Presumably to replace with just update.)
     */
    function clear() {
        if (_regionOverlay) {
            _regionOverlay.selectAll("g").remove();
        }
    }


    /**
     * Use d3 to update annotations, adding new ones and removing old ones.
     * The annotations are identified by their id.
     * @param {Array} annotations The currently placed annotations.
     */
    /**
     * Resolved promises on .transition().end() => updateAnnotations.inProgress(false)
     */
    function updateAnnotations(annotations){
        let timed=false;
        if (timingLog) {
            if (!updateAnnotations.inProgress()) {
                console.time('updateAnnotations');  //lets time only the first
                timed=true;
            }
        }

        //Draw annotations and update list asynchronously
        updateAnnotations.inProgress(true); //No function 'self' existing
        const regions = annotations.filter(annotation =>
            annotation.points.length > 1
        );

        const doneRegions = new Promise((resolve, reject) => {
            const regs = _regionOverlay.selectAll(".region")
                .data(regions, d => d.id)
                .join(
                    _enterRegion,
                    _updateRegion,
                    _exitRegion
                );

            if (regs.empty()) { //required even though end() should resolve directly on empty selection
                resolve();
            }
            else {
                regs
                    .transition()
                    .end()
                    .then(() => {
                        // console.log('Done with Region rendering');
                        resolve(); 
                    })
                    .catch(() => {
                        // console.warn('Sometimes we get a reject, just ignore!');
                        resolve(); //This also indicates that we're done
                    });
            }
        });

        Promise.allSettled([doneRegions])
            .catch((err) => { 
                console.warn('Region annotation rendering reported an issue: ',err); 
            })
            .finally(() => {
                updateAnnotations.inProgress(false);
                if (timed) {
                    console.timeEnd('updateRegionAnnotations');
                }
            });
    }
    // Counter to check if we're busy rendering
    updateAnnotations.inProgress = (function () { let flag = 0; return (set=null) => { if (set!=null) flag+=set?1:-1; return flag; }} )();

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
     * Enable the region editing tools for a specified region.
     * @param {number} id The id of the annotation corresponding to
     * the region.
     */
    function startRegionEdit(id) {
        if (!_regionOverlay) {
            return;
        }
        _regionOverlay.selectAll(".region")
            .filter(d => d.id === id)
            .each(function(d) { _createRegionEditControls(d, this); });
    }

    /**
     * Disable the region editing tools for a specified region.
     * @param {number} id The id of the annotation corresponding to
     * the region.
     */
    function stopRegionEdit(id) {
        if (!_regionOverlay) {
            return;
        }
        _regionOverlay.selectAll(".region")
            .filter(d => d.id === id)
            .each(function(d) { _removeRegionEditControls(d, this); });
    }

    /**
     * Let the overlay handler know the current zoom level and maximum
     * zoom level of the viewer in order to properly scale elements.
     * @param {number} zoomLevel The current zoom level of the OSD viewport.
     * @param {number} wContainer The maximum zoom level of the OSD viewport.
     */
    function setZoom(zoomLevel, maxZoom, wContainer) {
        const windowSizeAdjustment = 1400 / wContainer; //1000*sqrt(2)?
        _scale = windowSizeAdjustment / zoomLevel;
        _resizeMembers();
        _resizeRegions();
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
        
        _cursorOverlay = d3.select(cursors.node());
        _previousCursors = d3.local();

        _svo=svgOverlay;
        _svo._viewer.addHandler('update-viewport', () => {
            _currentMouseUpdateFun && _currentMouseUpdateFun(); //set cursor position if view-port changed by external source
        });
    }


    function setZ(level) {
        _svo._svg.style.zIndex=level;
    }

    /**
     * Called when layer is lowered away from top
     */
    function blur() {
        _regionOverlay.style("pointer-events", "none")
                    .transition("highlight").duration(500)
                    .style("opacity", 0.4);
    }

    /**
     * Called when layer is raised to top
     */
    function focus() {
        _regionOverlay.style("pointer-events", "fill")
                    .transition("highlight").duration(500)
                    .style("opacity", 1);
    }

    return {
        name: "region",
        clear,
        setZoom,
        setZ,
        blur,
        focus,
        init,


        updateMembers,
        updateAnnotations,
        updatePendingRegion,
        startRegionEdit,
        stopRegionEdit
    };
})();

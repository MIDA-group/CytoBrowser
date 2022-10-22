/**
 * Functions for updating the OpenSeadragon overlay.
 * @namespace overlayHandler
 **/
const overlayHandler = (function (){
    "use strict";

    const _markerSquareSize = 1/8,
        _markerCircleSize = 1/32,
        _markerSquareStrokeWidth = 0.03,
        _markerCircleStrokeWidth = 0.01;

    let _cursorOverlay,
        _markerOverlay,
        _regionOverlay,
        _pendingRegionOverlay,
        _activeAnnotationOverlayName,
        _previousCursors,
        _scale,
        _rotation,
        _maxScale,
        _markerScale = 1, //Modifcation factor
        _stage = null, //Pixi
        _app = null, //for renderer.plugins.interaction.moveWhenInside
        _markerContainer = null,
        _svo = null, //svg overlay
        _markerList = []

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

    function _markerSize() {
        return _markerScale**2*250*_maxScale*Math.pow(_scale/_maxScale, 0.4); //Let marker grow slowly as we zoom out, to keep it visible
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
        if (d.prediction == null) { //null or undef
            return `${d.mclass}`;
        }
        return `${d.prediction.toFixed(4)}: ${d.mclass}`;
    }

    function _resizeMembers() {
        _cursorOverlay.selectAll("g")
            .attr("transform", _transformFunction(function() {
                return {scale: _cursorSize(_previousCursors.get(this))};
            }));
    }

    function _resizeMarkers() {
//        console.log('Resize: ',_markerSize());
        _markerContainer.children.forEach(c => c.scale.set(_markerSize()/1000));
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
        _markerContainer.children.forEach(c => c.angle=-_rotation);
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
                                let mouse_offset; //offset (in webCoords) between mouse click and vertex
                                new OpenSeadragon.MouseTracker({
                                    element: path.node(),
                                    pressHandler: function(event) {
                                        tmapp.setCursorStatus({held: true});
                                        const mouse_pos = new OpenSeadragon.Point(event.originalEvent.offsetX,event.originalEvent.offsetY);
                                        const vertex_pos = coordinateHelper.imageToWeb(annotationHandler.getAnnotationById(d.id).points[i]);
                                        mouse_offset = mouse_pos.minus(vertex_pos);
                                    },
                                    releaseHandler: function(event) {
                                        tmapp.setCursorStatus({held: false});
                                    },
                                    dragHandler: function(event) {
                                        // Use a clone of the annotation to make sure the edit is permitted
                                        const dClone = annotationHandler.getAnnotationById(d.id);
                                        const pointClone = dClone.points[i];
                                        const mouse_pos = new OpenSeadragon.Point(event.originalEvent.offsetX,event.originalEvent.offsetY);
                                        const vertex_new_pos = coordinateHelper.webToImage(mouse_pos.minus(mouse_offset));
                                        Object.assign(pointClone,vertex_new_pos);
                                        annotationHandler.update(d.id, dClone, "image");
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

    /* Same as MouseEvents but with Pixi Interaction */
    /**
     * 
     * @param {annotation object} d 
     * @param {pixi graphics object} obj The (simple) object we set as interactive
     * @param {pixi graphics object} marker The whole marker object
     */
    function _addMarkerInteraction(d, obj, marker) {
        const id = d.id;
        let mouse_offset; //offset (in webCoords) between mouse click and object
        let pressed=false; //see also for drag vs. click: https://gist.github.com/fwindpeak/ce39d1acdd55cb37a5bcd8e01d429799

        function scale(obj,s) {
            Ease.ease.add(obj,{scale:s},{duration:100});
        }
        function alpha(obj,s) {
            Ease.ease.add(obj,{alpha:s},{duration:100});
        }

        function highlight(event) {
            scale(marker.getChildByName('square'),1.25);
            marker.addChild(_pixiMarkerLabel(d));
            //alpha(marker.getChildByName('label'),1);
        }
        function unHighlight(event) {
            if (pressed) return; //Keep highlight during drag
            scale(marker.getChildByName('square'),1);
            marker.getChildByName('label')?.destroy(true); //We might call unHighlight several times
            //alpha(marker.getChildByName('label'),0);
        }

        function pressHandler(event) {
            const isRightButton = event.data.button === 2;
//            console.log('PH: ',JSON.stringify(event.data)); //The event ages before logged
            if (isRightButton) {
                tmappUI.openAnnotationEditMenu(id, event.data.global);
            }
            else {
                tmapp.setCursorStatus({held: true});
                const mouse_pos = new OpenSeadragon.Point(event.data.global.x,event.data.global.y);
    //TODO: Use marker instead of slow looking up
                // console.log('pressid: ',id);
    //            const object_pos = new OpenSeadragon.Point(marker.position.x,marker.position.y);
                const object_pos = coordinateHelper.imageToWeb(annotationHandler.getAnnotationById(id).centroid);
                mouse_offset = mouse_pos.minus(object_pos);
                pressed=true;
                marker.pressed=true;

                //Fire move events also when the cursor is outside of the object
                _app.renderer.plugins.interaction.moveWhenInside = false;
                event.data.originalEvent.stopPropagation();
            }
        }
        function releaseHandler(event) {
            // event.currentTarget.releasePointerCapture(event.data.originalEvent.pointerId);
            tmapp.setCursorStatus({held: false});
            pressed=false;
            marker.pressed=false;
            _app.renderer.plugins.interaction.moveWhenInside = true;
        }
        function dragHandler(event) {
            if (!pressed) return;
            regionEditor.stopEditingRegion();

            const mouse_pos = new OpenSeadragon.Point(event.data.global.x,event.data.global.y);
            const object_new_pos = coordinateHelper.webToImage(mouse_pos.minus(mouse_offset)); //imageCoords

            // Use a clone of the annotation to make sure the edit is permitted
            const dClone = annotationHandler.getAnnotationById(id);
            const object_pos = dClone.centroid; //current pos imageCoords

            const delta = object_new_pos.minus(object_pos);
            dClone.points.forEach(point => {
                point.x += delta.x;
                point.y += delta.y;
            });
            annotationHandler.update(id, dClone, "image");

            const viewportCoords = coordinateHelper.pageToViewport({
                x: event.data.originalEvent.pageX,
                y: event.data.originalEvent.pageY
            });
            tmapp.setCursorStatus(viewportCoords);
        }
        function clickHandler(event) {
            if (event.data.originalEvent.ctrlKey) {
                // console.log('Remove');
                annotationHandler.remove(id);
            }
        }

        obj.interactive = true;
        //obj.buttonMode = true; //Button style cursor
        obj.interactiveChildren = false; //Just in case
        obj
            .on('pointerover', highlight)
            .on('pointerout', unHighlight)
            .on('pointerdown', pressHandler)
            .on('pointerup', releaseHandler)
            .on('pointerupoutside', (event) => {releaseHandler(event);unHighlight(event);})
            .on('pointermove', dragHandler)
            .on('click', clickHandler);
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
        new OpenSeadragon.MouseTracker({
            element: node,
            clickHandler: function(event) {
                regionEditor.stopEditingRegion();
                if (event.originalEvent.ctrlKey) {
                    annotationHandler.remove(d.id);
                }
                else if (getActiveAnnotationOverlay()==="region") {
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
                const mouse_pos = new OpenSeadragon.Point(event.originalEvent.offsetX,event.originalEvent.offsetY);
                const object_pos = coordinateHelper.imageToWeb(annotationHandler.getAnnotationById(d.id).centroid);
                mouse_offset = mouse_pos.minus(object_pos);
            },
            releaseHandler: function(event) {
                tmapp.setCursorStatus({held: false});
            },
            dragHandler: function(event) {
                regionEditor.stopEditingRegion();

                const mouse_pos = new OpenSeadragon.Point(event.originalEvent.offsetX,event.originalEvent.offsetY);
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
                    console.log('RBx: ',d.id,location);
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

    function _pixiMarker(d) {
        const viewport = coordinateHelper.imageToViewport(d.points[0]);
        const coords = coordinateHelper.viewportToOverlay(viewport);

        const color = _getAnnotationColor(d).replace('#','0x');
        const step=Math.SQRT2*_markerSquareSize*1000; //Rounding errors in Pixi for small values, thus '*1000'
        
        const graphics = new PIXI.Graphics();
        
        // Rectangle
        const square = new PIXI.Graphics();
        square.name="square";
        // Frame
        const frame = new PIXI.Graphics()
            .lineStyle(_markerSquareStrokeWidth*1000, color)
            .drawRect(-step,-step,2*step,2*step); //x,y,w,h
        frame.name="frame";
        // Transparent dark fill
        const bg = new PIXI.Graphics()
            .beginFill(0xFF0000)
            .lineStyle(0)
            .drawRect(-step,-step,2*step,2*step) //x,y,w,h
            .endFill();
        bg.alpha=0.2;
        square.addChild(bg,frame); //.setParent() does not give correct render order
        square.angle=45; 
        graphics.addChild(square);

        // Circle
        const circle = new PIXI.Graphics()
            .lineStyle(_markerCircleStrokeWidth*1000, "0x808080") //gray
            .drawCircle(0, 0, 3.2*_markerCircleSize*1000);                 
        graphics.addChild(circle);

        // Global part
        graphics.position.set(coords.x,coords.y);
        graphics.angle=-_rotation;
        graphics.scale.set(0);
        graphics.id=d.id; //non-pixi, just data

        _addMarkerInteraction(d,bg,graphics); //mouse interface to the simplest item
        _markerContainer.addChild(graphics);
        Ease.ease.add(graphics,{scale:_markerSize()/1000},{duration:250});

        return graphics;
    }

    // Generating labels for >10k objects is slow, so we just use single add/remove instead
    /**
     * 
     * @param {annotation object} d 
     */
    function _pixiMarkerLabel(d) {
        // Text label
        const label = new PIXI.Text(_getAnnotationText(d), {
            fontSize: 26,
            fontWeight: 700,
            fill: _getAnnotationColor(d)
        });
        label.name="label";
        label.roundPixels = true;
        label.resolution = 8;
        label.alpha = 1;
        label.position.set(6.2*_markerCircleSize*1000, -11*_markerCircleSize*1000);
        label.scale.set(6);
        return label;
    }

    // New marker
    function _enterMarker(enter) {
        return enter.append("g")
            .each(d => {
                // console.log('AID: ',d.id);
                _markerList[d.id]=_pixiMarker(d);
            });
    }

    // Hack to do color change, https://www.html5gamedevs.com/topic/9374-change-the-style-of-line-that-is-already-drawn/page/2/
    PIXI.Graphics.prototype.updateLineStyle = function({width=null, color=null, alpha=null}={}) {
        this.geometry.graphicsData.forEach(data => {
            if (width!=null) { data.lineStyle.width = width; }
            if (color!=null) { data.lineStyle.color = color; }
            if (alpha!=null) { data.lineStyle.alpha = alpha; }
        });
        this.geometry.invalidate();
    }

    let _easeTimeout = 0;
    function _updateMarker(update) {
        return update.each(d => {
            // console.log('UID: ',d.id);
            let changed = false;
            const marker = _markerList[d.id];
            const viewport = coordinateHelper.imageToViewport(d.points[0]);
            const coords = coordinateHelper.viewportToOverlay(viewport);
            if (marker.position.x!==coords.x || marker.position.y!==coords.y) { 
                marker.position.set(coords.x,coords.y);
                changed = true;
            }

            const square = marker.getChildByName('square');
            const frame = square.getChildByName('frame');
            const color = _getAnnotationColor(d).replace('#','0x');
            if (color !== frame.line.color) { //alternatively use frame._lineStyle.color
                frame.line.color = color;
                frame.updateLineStyle({color});
                changed = true;
            }

            // Highligh changes a bit, with half alpha to say "hands off"
            if (changed && !marker.pressed) {
                const duration = 100; //0.1 second
                if (!_easeTimeout) {
                    Ease.ease.add(marker.getChildByName('square'),{scale:1.25,alpha:0.5},{duration});
                }
                else {
                    clearTimeout(_easeTimeout);
                }
                _easeTimeout = setTimeout(() => {
                    Ease.ease.add(marker.getChildByName('square'),{scale:1,alpha:1},{duration});
                    _easeTimeout = 0;
                }, duration); 
            }
        });
    }

    function _exitMarker(exit) {
        return exit.each(d => {
            // console.log('EID:',d.id);
            if (!_markerList[d.id]) {
                console.log(`EXIT: Marker #${d.id} lost before exit, probably from clearAnnotation.`);
                return;
            }
            Ease.ease.add(_markerList[d.id],{scale:_markerList[d.id].scale.x*2},{duration:30})
                .once('complete', (ease) => {
                    ease.elements.forEach(item=>item.destroy(true)); //Self destruct after animation
                });
            delete _markerList[d.id];
        }).remove();
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
                                const viewport = coordinateHelper.imageToViewport(point);
                                const coords = coordinateHelper.viewportToOverlay(viewport);
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
    function clearAnnotations(){
        if (_markerOverlay) {
            _markerOverlay.selectAll("g").remove(); //d3 still used as container

            _markerList.forEach(item=>item.destroy(true));
            _markerList=[];
        }
        if (_regionOverlay)
            _regionOverlay.selectAll("g").remove();
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
        console.time('updateAnnotations');

        updateAnnotations.inProgress(true); //No function 'self' existing
        const markers = annotations.filter(annotation =>
            annotation.points.length === 1
        );
        const regions = annotations.filter(annotation =>
            annotation.points.length > 1
        );

        const doneMarkers = new Promise((resolve, reject) => {
            const marks = _markerOverlay.selectAll("g")
                .data(markers, d => d.id)
                .join(
                    _enterMarker,
                    _updateMarker,
                    _exitMarker
                );

            if (marks.empty()) {
                resolve();
            }
            else {
                marks
                    .transition()
                    .end()
                    .then(() => {
                        // console.log('Done with Marker rendering');
                        resolve(); 
                    })
                    .catch(() => {
                        // console.warn('Sometimes we get a reject, just ignore!');
                        // reject(); 
                        resolve(); //This also indicates that we're done
                    });
            }
        });
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
                        // reject(); 
                        resolve(); //This also indicates that we're done
                    });
            }
        });

        Promise.allSettled([doneMarkers,doneRegions])
            .then(() => {
                updateAnnotations.inProgress(false);
                console.log('Update completed');
                console.timeEnd('updateAnnotations');
            })
            .catch((err) => { 
                console.warn('Annotation rendering reported an issue: ',err); 
            });
    }
    // Boolean to check if we're busy rendering
    updateAnnotations.inProgress = (function () { let flag = false; return (set=null) => { if (set!=null) flag=set; return flag; }} )();

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
    function setOverlayScale(zoomLevel, maxZoom, wContainer, hContainer) {
        const windowSizeAdjustment = 1400 / wContainer;
        _scale = windowSizeAdjustment / zoomLevel;
        _maxScale = windowSizeAdjustment / maxZoom;
        _resizeMembers();
        _resizeMarkers();
        _resizeRegions();
    }

    function setMarkerScale(scale) {
        _markerScale=scale;
        _resizeMarkers();
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
        function alpha(obj,s) {
            Ease.ease.add(obj,{alpha:s},{duration:200});
        }

        _activeAnnotationOverlayName = name;
        if (!_regionOverlay || !_markerOverlay)
            return;

        switch (name) {
            case "region":
                _regionOverlay.style("pointer-events", "fill")
                    .transition("highlight").duration(500)
                    .style("opacity", 1);
                if (_markerContainer) {
                    alpha(_markerContainer,0.4);
                    _svo._svg.style.zIndex=1;
                }
                break;
            case "marker":
                _regionOverlay.style("pointer-events", "none")
                    .transition("highlight").duration(500)
                    .style("opacity", 0.4);
                if (_markerContainer) {
                    alpha(_markerContainer,1);
                    _svo._svg.style.zIndex=0;
                }
                break;
            default:
                throw new Error("Invalid overlay name.");
        }
    }
    function getActiveAnnotationOverlay() {
        return _activeAnnotationOverlayName;
    }

    /**
     * Initialize the overlay handler. Should be called whenever OSD is
     * initialized.
     * @param {Object} svgOverlay The return value of the OSD instance's
     * svgOverlay() method.
     */
    function init(svgOverlay,app=null) {
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

        _stage=app.stage;
        _app=app;
        _markerContainer = new PIXI.Container();
        _stage.addChild(_markerContainer);
        _svo=svgOverlay;
    }

    return {
        updateMembers,
        updateAnnotations,
        updatePendingRegion,
        startRegionEdit,
        stopRegionEdit,
        clearAnnotations,
        setOverlayScale,
        setMarkerScale,
        setOverlayRotation,
        setActiveAnnotationOverlay,
        getActiveAnnotationOverlay,
        init
    };
})();

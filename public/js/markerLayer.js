/**
 * Functions for updating the marker annotation overlay.
 * @namespace markerLayer
 **/

const markerLayer = (function (){
    "use strict";

    const timingLog = false; //Log update times

    const _markerSquareSize = 1/8,
        _markerCircleSize = 1/32,
        _markerSquareStrokeWidth = 0.03,
        _markerCircleStrokeWidth = 0.01;

    let _markerOverlay,
        _zoomLevel,
        _wContainer,
        _scale,
        _rotation,
        _maxScale,
        _markerScale = 1, //Modifcation factor

        _stage = null, //Pixi
        _app = null, //for renderer.plugins.interaction.moveWhenInside
        _markerContainer = null,
        _pxo = null, //pixi overlay
        _markerList = [],
        _currentMouseUpdateFun = null;

    
    function _markerSize() {
        return _markerScale**2*250*_maxScale*Math.pow(_scale/_maxScale, 0.4); //Let marker grow slowly as we zoom out, to keep it visible
    }

    //Approx from corner to corner (middle of line), in screen pixels
    function _markerDiameter() { 
        return _markerSize()/2*_zoomLevel*_wContainer/1000;
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

    
    /**
     * Set marker visible if inside rectangle, or pressed
     * @param {Rectangle} rect in Screen/Web coordinates, typically _app.renderer.screen
     */
    let _first=true;
    let oldUl={};
    let oldDr={};
    function _cullMarkers(rect = _app.renderer.screen) {
        if (_markerContainer.children.length) {
            //Check if the view actually changed
            const ul=coordinateHelper.overlayToWeb({x:0,y:0});
            const dr=coordinateHelper.overlayToWeb({x:1000,y:1000});
            if (_first || ul.x!=oldUl.x || ul.y!=oldUl.y || dr.x!=oldDr.x || dr.y!=oldDr.y) {
                _first=false;
                oldUl=ul;
                oldDr=dr;
                rect=rect.clone().pad(_markerDiameter()/2); //So we see frame also when outside

                let vis=0;
                _markerContainer.children.forEach(c => {
                    const webPos = coordinateHelper.overlayToWeb(c.position);
                    c.visible = c.pressed || rect.contains(webPos.x,webPos.y);
                    vis += c.visible;
                });
                console.log('Visible markers: ',vis);
            }
        }
    }

    
    function _resizeMarkers() {
//        console.log('Resize: ',_markerSize());
        //_markerContainer.children.forEach(c => c.scale.set(_markerSize()/1000));
        const visCirc=_markerDiameter()>10; //Smaller than 10 pix and we skip the circle
        _markerContainer.children.forEach(c => {
            c.scale.set(_markerSize()/1000);
            c.getChildByName('circle').visible=visCirc;
        });
        _pxo.update();
    }

    function _rotateMarkers() {
        _markerContainer.children.forEach(c => c.angle=-_rotation);
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
        let mouse_pos; //retain last used mouse_pos (global) s.t. we may update locations when keyboard panning etc.
        let mouse_offset; //offset (in webCoords) between mouse click and object
        let pressed=false; //see also for drag vs. click: https://gist.github.com/fwindpeak/ce39d1acdd55cb37a5bcd8e01d429799

        function scale(obj,s) {
            return Ease.ease.add(obj,{scale:s},{duration:100});
        }
        function alpha(obj,s) {
            return Ease.ease.add(obj,{alpha:s},{duration:100});
        }

        function highlight(event) {
            scale(marker.getChildByName('square'),1.25);
            if (!marker.getChildByName('label')) //Add text if not there
                marker.addChild(_pixiMarkerLabel(d));
            _pxo.update();
        }
        function unHighlight(event) {
            if (pressed) return; //Keep highlight during drag
            scale(marker.getChildByName('square'),1);
            const label=marker.getChildByName('label');
            if (label) { //We might call unHighlight several times
                alpha(label,0) //Ease out
                    .once('complete', (ease) => ease.elements.forEach(item=>{ if (!item.destroyed) item.destroy(true);}));
            }
            _pxo.update();
        }

        function pressHandler(event) {
//            console.log('PH: ',JSON.stringify(event.data)); //The event ages before logged

            const isRightButton = event.data.button === 2;
            if (isRightButton) {
                tmappUI.openAnnotationEditMenu(id, event.data.global);
            }
            else {
                event.data.originalEvent.stopPropagation(); //Sometimes works, sometimes not (for touch, depending e.g., on Chrome state)
                tmapp.setCursorStatus({held: true});
                mouse_pos = new OpenSeadragon.Point(event.data.global.x,event.data.global.y);
    //TODO: Use marker instead of slow looking up
                // console.log('pressid: ',id);
    //            const object_pos = new OpenSeadragon.Point(marker.position.x,marker.position.y);
                const object_pos = coordinateHelper.imageToWeb(annotationHandler.getAnnotationById(id).centroid);
                mouse_offset = mouse_pos.minus(object_pos);
                pressed=true;
                marker.pressed=true;
                _currentMouseUpdateFun=updateMousePos;

                //Fire move events also when the cursor is outside of the object
                _app.renderer.plugins.interaction.moveWhenInside = false;
            }
            highlight(event);
            _pxo.update();
        }
        function releaseHandler(event) {
            // event.currentTarget.releasePointerCapture(event.data.originalEvent.pointerId);
            tmapp.setCursorStatus({held: false});
            pressed=false;
            marker.pressed=false;
            _currentMouseUpdateFun=null;
            _app.renderer.plugins.interaction.moveWhenInside = true;
            unHighlight(event);
            _pxo.update();
        }
        function dragHandler(event) {
            if (!pressed) return;
            regionEditor.stopEditingRegion();
            mouse_pos = new OpenSeadragon.Point(event.data.global.x,event.data.global.y);
            updateMousePos();
        }
        function updateMousePos() {
            if (!pressed) return;
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

            const viewportCoords = coordinateHelper.webToViewport(mouse_pos);
            tmapp.setCursorStatus(viewportCoords);
            _pxo.update();
        }
        function tapHandler(event) {
            if (event.data.originalEvent.ctrlKey) {
                // console.log('Remove');
                annotationHandler.remove(id);
            }
            _pxo.update();
        }

        obj.interactive = true;
        //obj.buttonMode = true; //Button style cursor
        obj.interactiveChildren = false; //Just in case
        obj
            .on('pointerover', highlight) //enter is not enough
            .on('pointerout', unHighlight) 
            .on('pointerdown', pressHandler) //calling highlight
            .on('pointerup', releaseHandler) //calling unHighlight
            .on('pointerupoutside', releaseHandler)
            .on('pointermove', dragHandler)
            .on('pointertap', tapHandler) //replaces click (fired after the pointerdown and pointerup events)
            ;
    }


    function _pixiMarker(d, duration=0) {
        const coords = coordinateHelper.imageToOverlay(d.points[0]);

        const color = _getAnnotationColor(d).replace('#','0x');
        const step=Math.SQRT2*_markerSquareSize*1000; //Rounding errors in Pixi for small values, thus '*1000'
        
        const graphics = new PIXI.Graphics();
        // Inner circle (not in base object, since we wish to rescale and turn it on/off)
        const circle = new PIXI.Graphics() 
            .lineStyle(_markerCircleStrokeWidth*100, "0x808080") //gray
            .drawCircle(0, 0, 3.2*_markerCircleSize*100);
        circle.scale.set(10); // Number of segments is dependent on original object size
        circle.name="circle";

        // Tilted square
        const square = new PIXI.Graphics()
            .beginFill(0x000000,0.2)
            .lineStyle(_markerSquareStrokeWidth*1000, color)
            .drawRect(-step,-step,2*step,2*step) //x,y,w,h
            .endFill();
        square.angle=45; 
        square.name="square";
        graphics.addChild(square,circle);

        // Global part
        graphics.position.set(coords.x,coords.y);
        graphics.angle=-_rotation;
        graphics.scale.set(0);
        graphics.id=d.id; //non-pixi, just data

        //Works ok, but our own is faster
        //graphics.cullable=true;

        _addMarkerInteraction(d,square,graphics); //mouse interface to the simplest item
        _markerContainer.addChild(graphics);
        if (duration > 0) {
            graphics.scale.set(0);
            Ease.ease.add(graphics,{scale:_markerSize()/1000},{duration:duration});
        }
        else {
            graphics.scale.set(_markerSize()/1000);
        }
        // .once('complete', (ease) => ease.elements.forEach(item=>item.cacheAsBitmap=true));  //Doesn't really pay off

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
        const duration=Math.round(250/(1+enter.size())); //The more markers the shorter animation
        return enter.append("g")
            .each(d => {
                //console.log('AID: ',d.id,duration);
                _markerList[d.id]=_pixiMarker(d,duration);
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
            const coords = coordinateHelper.imageToOverlay(d.points[0]);
            if (marker.position.x!==coords.x || marker.position.y!==coords.y) { 
                marker.position.set(coords.x,coords.y);
                changed = true;
            }

            const square = marker.getChildByName('square');
            const color = _getAnnotationColor(d).replace('#','0x');
            if (color !== square.line.color) { //alternatively use square._lineStyle.color
                square.line.color = color;
                square.updateLineStyle({color});
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
            Ease.ease.add(_markerList[d.id],{scale:_markerList[d.id].scale.x*1.5},{duration:30})
                .once('complete', (ease) => {
                    ease.elements.forEach(item=>item.destroy(true)); //Self destruct after animation
                });
            delete _markerList[d.id];
        }).remove();
    }


    /**
     * Clear all annotations currently in the overlay, in case you need to quickly replace them.
     * (Presumably to replace with just update.)
     */
    function clear() {
        if (_markerOverlay) {
            _markerOverlay.selectAll("g").remove(); //d3 still used as container

            _markerList.forEach(item=>item.destroy(true));
            _markerList=[];
        }
        _pxo.update();
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
        _pxo.update();

        let timed=false;
        if (timingLog) {
            if (!updateAnnotations.inProgress()) {
                console.time('updateAnnotations');  //lets time only the first
                timed=true;
            }
        }

        //Draw annotations and update list asynchronously
        updateAnnotations.inProgress(true); //No function 'self' existing
        const markers = annotations.filter(annotation =>
            annotation.points.length === 1
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
                        resolve(); //This also indicates that we're done
                    });
            }
        });

        Promise.allSettled([doneMarkers])
            .catch((err) => { 
                console.warn('Annotation rendering reported an issue: ',err); 
            })
            .finally(() => {
                updateAnnotations.inProgress(false);
                if (timed) {
                    console.timeEnd('updateAnnotations');
                }
            });
    }
    // Counter to check if we're busy rendering
    updateAnnotations.inProgress = (function () { let flag = 0; return (set=null) => { if (set!=null) flag+=set?1:-1; return flag; }} )();


    /**
     * Let the overlay handler know the current zoom level and maximum
     * zoom level of the viewer in order to properly scale elements.
     * @param {number} zoomLevel The current zoom level of the OSD viewport.
     * @param {number} wContainer The maximum zoom level of the OSD viewport.
     */
    function setZoom(zoomLevel, maxZoom, wContainer) {
        const windowSizeAdjustment = 1400 / wContainer; //1000*sqrt(2)?
        _zoomLevel = zoomLevel;
        _wContainer = wContainer;
        _scale = windowSizeAdjustment / zoomLevel;
        _maxScale = windowSizeAdjustment / maxZoom;
        _resizeMarkers();
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
    function setRotation(rotation) {
        _rotation = rotation;
        _rotateMarkers();
    }

    /**
     * Initialize the overlay handler. Should be called whenever OSD is
     * initialized.
     * @param {Object} svgOverlay The return value of the OSD instance's
     * svgOverlay() method.
     */
    function init(pixiOverlay) {
        const markers = d3.create('g')
            .attr("id", "markers");
        _markerOverlay = d3.select(markers.node());
        _pxo=pixiOverlay;
        _app=_pxo.app();
        _stage=_app.stage;
    
        _pxo._viewer.addHandler('update-viewport', () => {
            _currentMouseUpdateFun && _currentMouseUpdateFun(); //set cursor position if view-port changed by external source
        });

        _markerContainer = new PIXI.Container();
        _stage.addChild(_markerContainer);
    
        // "prerender" is fired right before the renderer draws the scene
        _app.renderer.on('prerender', () => {
            _cullMarkers();
        });
    }


    function setZ(level) {
        //_svo._svg.style.zIndex=level;
    }

    function _alpha(obj,s) {
        Ease.ease.add(obj,{alpha:s},{duration:200});
    }

    /**
     * Called when layer is lowered away from top
     */
    function blur() {
        if (_markerContainer) {
            _alpha(_markerContainer,0.4);
        }
        _pxo.update();
    }

    /**
     * Called when layer is raised to top
     */
    function focus() {
        if (_markerContainer) {
            _alpha(_markerContainer,1);
        }
        _pxo.update();
    }

    return {
        name: "marker",
        clear,
        setZoom,
        setMarkerScale,
        setRotation,
        setZ,
        blur,
        focus,
        init,

        updateAnnotations
    };
})();

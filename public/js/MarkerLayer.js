"use strict";
/**
 * Class for the marker annotation overlay.
 **/

class MarkerLayer extends OverlayLayer {
    #timingLog = false; //Log update times

    #markerSquareSize = 1/8;
    #markerCircleSize = 1/32;
    #markerSquareStrokeWidth = 0.03;
    #markerCircleStrokeWidth = 0.01;

    #zoomLevel;
    #wContainer;
    #scale;
    #rotation;
    #maxScale;
    #markerScale = 1; //Modifcation factor
    #markerTextures = null;

    #overlayObject = null; //For destroy
    #stage = null; //Pixi stage
    #renderer = null; //Pixi renderer (for interaction manipulation)
    #drawUpdate = null; //Rendring update function

    #spatialMarkerIndex = new RBush();
    #annotationIdToMarker = new Map();
    
    #markerOverlay;
    #markerContainer = null;
    #markerList = [];

    #annotationUpdatePending = false;
    #latestAnnotations = null;

    #lastLogTime = 0;
    #logThrottleDelay = 500;

    #currentMouseUpdateFun = null;

    /**
     * @param {string} name - Typically "marker"
     * @param {Object} pixiOverlay - pixiOverlay of the OSD
     */
    constructor(name,pixiOverlay) {
        super(name,pixiOverlay._viewer,pixiOverlay._pixi);
        this.overlayObject=pixiOverlay;
        
        this.#stage=pixiOverlay._app.stage;
        this.#renderer=pixiOverlay._app.renderer; 

        this.#createMarkerTextures();

        //this.#drawUpdate=pixiOverlay.update; // Call this function when drawing anything, see pixi-overlay
        this.#drawUpdate=() => pixiOverlay.update(); // Aaargh, the 'this' functionality in JS is just... sigh!

        // Counter to check if we're busy rendering; Immediate function returning a function
        this.updateAnnotations.inProgress = (function () { let flag = 0; return (set=null) => { if (set!=null) flag+=set?1:-1; return flag; }} )();
    
        // D3 node just for keeping track, no rendering, to be removed in due time
        this.#markerOverlay = d3.create('g')
            .attr("id", "markers");
    
        // Pixi container for rendering
        this.#markerContainer = new PIXI.Container();
        this.#stage.addChild(this.#markerContainer);

        this._viewer.addHandler('update-viewport', () => {
            this.#currentMouseUpdateFun && this.#currentMouseUpdateFun(); //set cursor position if view-port changed by external source
        });

        // "prerender" is fired right before the renderer draws the scene
        this.#renderer.on('prerender', () => {
            this.#cullMarkers();
        });
    }

    destroy(destroyOverlay = false) {
        if (destroyOverlay && this.overlayObject) {
            this.overlayObject.destroy();
            this.overlayObject=null;
        }
    }

    get #markerSize() {
        return this.#markerScale**2*0.25*this.#maxScale*Math.pow(this.#scale/this.#maxScale, 0.4); //Let marker grow slowly as we zoom out, to keep it visible
    }

    //Approx from corner to corner (middle of line), in screen pixels
    get #markerDiameter() { 
        return this.#markerSize/2*this.#zoomLevel*this.#wContainer;
    }

    #createMarkerTextures() {
        this.#markerTextures = {};
        const classConfig = classUtils.getClassConfig();

        const _createMarkerTexture = (color) => {
            const step = Math.SQRT2 * this.#markerSquareSize * 1000;
            const graphics = new PIXI.Graphics();
            const circle = new PIXI.Graphics()
                .lineStyle(this.#markerCircleStrokeWidth * 100, "0x808080")
                .drawCircle(0, 0, 3.2 * this.#markerCircleSize * 100);
            circle.scale.set(10);
            circle.name = "circle";
            const square = new PIXI.Graphics()
                .beginFill(0x000000, 0.2)
                .lineStyle(this.#markerSquareStrokeWidth * 1000, parseInt(color))
                .drawRect(-step, -step, 2 * step, 2 * step)
                .endFill();
            square.angle = 45;
            square.name = "square";
            graphics.addChild(square, circle);
            const texture = this.#renderer.generateTexture(graphics);
            graphics.destroy({ children: true });
            return texture;
        };

        classConfig.forEach(c => {
            const texture = _createMarkerTexture(c.color.replace('#', '0x'));
            this.#markerTextures[c.name] = texture;
        });
    }

    
    /**
     * Set marker visible if inside rectangle, or pressed
     * @param {Rectangle} rect in Screen/Web coordinates, typically this.#renderer.screen
     */
    #first=true;
    #oldUl={};
    #oldDr={};
    #cullMarkers(rect = this.#renderer.screen) {
        if (this.#markerContainer.children.length) {
            //Check if the view actually changed
            const ul=coordinateHelper.overlayToWeb({x:0,y:0});
            const dr=coordinateHelper.overlayToWeb({x:1000,y:1000});
            if (this.#first || ul.x!=this.#oldUl.x || ul.y!=this.#oldUl.y || dr.x!=this.#oldDr.x || dr.y!=this.#oldDr.y) {
                this.#first=false;
                this.#oldUl=ul;
                this.#oldDr=dr;
                rect=rect.clone().pad(this.#markerDiameter/2); //So we see frame also when outside

                const topLeft = coordinateHelper.webToImage({ x: rect.x, y: rect.y });
                const bottomRight = coordinateHelper.webToImage({ x: rect.x + rect.width, y: rect.y + rect.height });

                const visibleMarkers = this.#spatialMarkerIndex.search({
                    minX: topLeft.x,
                    minY: topLeft.y,
                    maxX: bottomRight.x,
                    maxY: bottomRight.y
                });
                const visibleIDs = new Set(visibleMarkers.map(m => m.id));

                let vis = 0;
                this.#markerContainer.children.forEach(marker => {
                    marker.visible = marker.pressed || visibleIDs.has(marker.id);
                    vis += marker.visible;
                });

                const now = performance.now();
                if (now - this.#lastLogTime > this.#logThrottleDelay) {
                    console.log('Visible markers:', vis);
                    this.#lastLogTime = now;
                }
            }
        }
    }

    
    #resizeMarkers() {
//        console.log('Resize: ',this.#markerSize);
        this.#markerContainer.children.forEach(c => {
            c.scale.set(this.#markerSize);
        });
        this.#drawUpdate();
    }

    #rotateMarkers() {
        this.#markerContainer.children.forEach(c => c.angle=-this.#rotation);
    }


    /* Same as MouseEvents but with Pixi Interaction */
    /**
     * 
     * @param {annotation object} d 
     * @param {pixi graphics object} obj The (simple) object we set as interactive
     * @param {pixi graphics object} marker The whole marker object
     */
    #addMarkerInteraction(d, obj, marker) {
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

        //Arrow functions required to preserve this
        const highlight = (event) => {
            scale(marker, 1.25*this.#markerSize);
            if (!marker.getChildByName('label')) //Add text if not there
                marker.addChild(this.#pixiMarkerLabel(d));
            this.#drawUpdate();
        }
        const unHighlight = (event) => {
            if (pressed) return; //Keep highlight during drag
            scale(marker, this.#markerSize);
            const label=marker.getChildByName('label');
            if (label) { //We might call unHighlight several times
                alpha(label,0) //Ease out
                    .once('complete', (ease) => ease.elements.forEach(item=>{ if (!item.destroyed) item.destroy(true);}));
            }
            this.#drawUpdate();
        }

        const pressHandler=(event) => {
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
                this.#currentMouseUpdateFun=updateMousePos;

                //Fire move events also when the cursor is outside of the object
                this.#renderer.plugins.interaction.moveWhenInside = false;
            }
            highlight(event);
            this.#drawUpdate();
        }
        const releaseHandler=(event) => {
            // event.currentTarget.releasePointerCapture(event.data.originalEvent.pointerId);
            tmapp.setCursorStatus({held: false});
            pressed=false;
            marker.pressed=false;
            this.#currentMouseUpdateFun=null;
            this.#renderer.plugins.interaction.moveWhenInside = true;
            unHighlight(event);
            this.#drawUpdate();
        }
        const dragHandler=(event) => {
            if (!pressed) return;
            regionEditor.stopEditingRegion();
            mouse_pos = new OpenSeadragon.Point(event.data.global.x,event.data.global.y);
            updateMousePos();
        }
        const updateMousePos=() => {
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
            this.#drawUpdate();
        }
        let _taps=0;
        const tapHandler=(event) => {
            _taps++;
            setTimeout(()=>_taps=0,300);
            if (event.data.originalEvent.ctrlKey) {
                // console.log('Remove');
                annotationHandler.remove(id);
            }
            else {
                //if (_taps>0) {console.log('Taps: ',_taps);}
                if (_taps==2) {
                    tmappUI.openAnnotationEditMenu(id, event.data.global);
                }
            }
            this.#drawUpdate();
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


    #pixiMarker(d, duration=0) {
        const coords = coordinateHelper.imageToOverlay(d.points[0]);
        const texture = this.#markerTextures[d.mclass];
        if (!texture) {
            console.warn(`No texture found for marker type ${d.mclass}`);
            return null;
        }

        const sprite = new PIXI.Sprite(texture);
        sprite.anchor.set(0.5);
        sprite.position.set(coords.x, coords.y);
        sprite.angle = -this.#rotation;
        sprite.scale.set(0);
        sprite.id = d.id;
        sprite.mclass = d.mclass;

        this.#addMarkerInteraction(d, sprite, sprite);
        this.#markerContainer.addChild(sprite);

        if (duration > 0) {
            sprite.scale.set(0);
            Ease.ease.add(sprite, { scale: this.#markerSize }, { duration: duration });
        } else {
            sprite.scale.set(this.#markerSize);
        }

        return sprite;
    }

    /**
     * Generating labels for >10k objects is slow, so we just use single add/remove instead
     * @param {annotation object} d 
     */
    #pixiMarkerLabel(d) {
        // Text label
        const label = new PIXI.Text(this._getAnnotationText(d), {
            fontSize: 26,
            fontWeight: 700,
            fill: this._getAnnotationColor(d)
        });
        label.name="label";
        label.roundPixels = true;
        label.resolution = 8;
        label.alpha = 1;
        label.position.set(6.2*this.#markerCircleSize*1000, -11*this.#markerCircleSize*1000);
        label.scale.set(6);
        return label;
    }

    // New marker
    #enterMarker(enter) {
        const duration=Math.round(250/(1+enter.size())); //The more markers the shorter animation
        return enter.append("g")
            .each(d => {
                // console.log('AID: ',d.id,duration);
                this.#markerList[d.id]=this.#pixiMarker(d,duration);

                // Add marker to spatial index and ID map
                const x = d.points[0].x;
                const y = d.points[0].y;
                const markerItem = {
                    minX: x,
                    minY: y,
                    maxX: x,
                    maxY: y,
                    id: d.id,
                };
                this.#spatialMarkerIndex.insert(markerItem);
                this.#annotationIdToMarker.set(d.id, markerItem);
            });
    }

    #easeTimeout = 0;
    #updateMarker(update) {
        return update.each(d => {
            // console.log('UID: ',d.id);
            let changed = false;
            const marker = this.#markerList[d.id];
            const coords = coordinateHelper.imageToOverlay(d.points[0]);
            if (marker.position.x!==coords.x || marker.position.y!==coords.y) { 
                marker.position.set(coords.x,coords.y);
                changed = true;
                
                // Update marker in spatial index and ID map
                const existingMarker = this.#annotationIdToMarker.get(d.id);
                this.#spatialMarkerIndex.remove(existingMarker, (a, b) => a.id === b.id);
                const x = d.points[0].x;
                const y = d.points[0].y;
                const markerItem = {
                    minX: x,
                    minY: y,
                    maxX: x,
                    maxY: y,
                    id: d.id,
                };
                this.#spatialMarkerIndex.insert(markerItem);
                this.#annotationIdToMarker.set(d.id, markerItem);
            }
            
            if (marker.mclass!==d.mclass) {
                marker.texture = this.#markerTextures[d.mclass];
                marker.mclass = d.mclass;
                changed = true;
            }

            // Highligh changes a bit, with half alpha to say "hands off"
            if (changed && !marker.pressed) {
                const duration = 100; //0.1 second
                if (!this.#easeTimeout) {
                    Ease.ease.add(marker,{scale:1.25*this.#markerSize,alpha:0.5},{duration});
                }
                else {
                    clearTimeout(this.#easeTimeout);
                }
                this.#easeTimeout = setTimeout(() => {
                    Ease.ease.add(marker,{scale:this.#markerSize,alpha:1},{duration});
                    this.#easeTimeout = 0;
                }, duration); 
            }
        });
    }

    #exitMarker(exit) {
        return exit.each(d => {
            // console.log('EID:',d.id);
            if (!this.#markerList[d.id]) {
                console.log(`EXIT: Marker #${d.id} lost before exit, probably from clearAnnotation.`);
                return;
            }
            Ease.ease.add(this.#markerList[d.id],{scale:this.#markerList[d.id].scale.x*1.5},{duration:30})
                .once('complete', (ease) => {
                    ease.elements.forEach(item=>item.destroy(true)); //Self destruct after animation
                });
            delete this.#markerList[d.id];
            const existingMarker = this.#annotationIdToMarker.get(d.id);
            this.#spatialMarkerIndex.remove(existingMarker, (a, b) => a.id === b.id);
            this.#annotationIdToMarker.delete(d.id);
        }).remove();
    }


    /**
     * Clear all annotations currently in the overlay, in case you need to quickly replace them.
     * (Presumably to replace with just update.)
     */
    clear() {
        this.#markerOverlay.selectAll("g").remove(); //d3 still used as container

        this.#markerList.forEach(item=>item.destroy(true));
        this.#markerList=[];
        
        this.#markerContainer.removeChildren(); //Without this, we get an error in cullMarkers
        this.#spatialMarkerIndex.clear();
        this.#annotationIdToMarker.clear();
      
        this.#drawUpdate();
    }


    /**
     * Use d3 to update annotations, adding new ones and removing old ones.
     * The annotations are identified by their id.
     * @param {Array} annotations The currently placed annotations.
     */
    /**
     * Resolved promises on .transition().end() => updateAnnotations.inProgress(false)
     */
    updateAnnotations(annotations){
        this.#latestAnnotations = annotations;
        if (!this.#annotationUpdatePending) {
            this.#annotationUpdatePending = true;
            requestAnimationFrame(() => {
                this.#annotationUpdatePending = false;
                this.#updateAnnotations(this.#latestAnnotations);
            });
        }
    }

    #updateAnnotations(annotations) {
        this.#drawUpdate();
        if (annotations.length>0) this.#createMarkerTextures();   // This is here temporary, should be handled better

        let timed=false;
        if (this.#timingLog) {
            if (!this.updateAnnotations.inProgress()) {
                console.time('updateAnnotations');  //lets time only the first
                timed=true;
            }
        }

        //Draw annotations and update list asynchronously
        this.updateAnnotations.inProgress(true); //No function 'self' existing
        const markers = annotations.filter(annotation =>
            annotation.points.length === 1
        );

        const doneMarkers = new Promise((resolve, reject) => {
            const marks = this.#markerOverlay.selectAll("g")
                .data(markers, d => d.id)
                .join(
                    //function wrapper required to keep this object
                    enter => this.#enterMarker(enter),
                    update => this.#updateMarker(update),
                    exit => this.#exitMarker(exit)
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
                this.updateAnnotations.inProgress(false);
                if (timed) {
                    console.timeEnd('updateAnnotations');
                }
            });
    }


    /**
     * Let the overlay handler know the current zoom level and maximum
     * zoom level of the viewer in order to properly scale elements.
     * @param {number} zoomLevel The current zoom level of the OSD viewport.
     * @param {number} wContainer The maximum zoom level of the OSD viewport.
     */
    setZoom(zoomLevel, maxZoom, wContainer) {
        const windowSizeAdjustment = 1400 / wContainer; //1000*sqrt(2)?
        this.#zoomLevel = zoomLevel;
        this.#wContainer = wContainer;
        this.#scale = windowSizeAdjustment / zoomLevel;
        this.#maxScale = windowSizeAdjustment / maxZoom;
        this.#resizeMarkers();
    }

    setMarkerScale(scale, delta=false) {
        this.#markerScale=delta?this.#markerScale+scale:scale;
        this.#resizeMarkers();
    }
    
    /**
     * Let the overlay handler know the rotation of the viewport in order
     * to properly adjust any elements that need to be rotated.
     * @param {number} rotation The current rotation of the OSD viewport.
     */
    setRotation(rotation) {
        this.#rotation = rotation;
        this.#rotateMarkers();
    }



    #alpha(obj,s) {
        Ease.ease.add(obj,{alpha:s},{duration:200});
    }

    /**
     * Called when layer is lowered away from top
     */
    blur() {
        if (this.#markerContainer) {
            this.#alpha(this.#markerContainer,0.4);
        }
        this.#drawUpdate();
    }

    /**
     * Called when layer is raised to top
     */
    focus() {
        if (this.#markerContainer) {
            this.#alpha(this.#markerContainer,1);
        }
        this.#drawUpdate();
    }
}



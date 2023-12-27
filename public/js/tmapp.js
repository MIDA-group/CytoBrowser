/**
 * Functions related to interaction with the OpenSeadragon viewer, including
 * initialization, image information, updating the current URL state, etc.
 * @namespace tmapp
 */
const tmapp = (function() {
    "use strict";

    const _imageDir = "data/";
    const _optionsOSD = {
        id: "ISS_viewer_0", //cybr_viewer
        prefixUrl: "js/openseadragon/images/", //Location of button graphics
        showNavigator: true,
        navigatorId: "navigator_div", //Navigator postition doesn't matter here
        toolbar: "toolbar_subdiv", //This is somehow lost in the OSD docs
        animationTime: 0.0,
        blendTime: 0.4,
        maxImageCacheCount: 800, //need more for z-stacks
        minZoomImageRatio: 1,
        maxZoomPixelRatio: 4,
        gestureSettingsMouse: {clickToZoom: false, dblClickToZoom: false},
        gestureSettingsTouch: {clickToZoom: false, dblClickToZoom: false},
        gestureSettingsPen: {clickToZoom: false, dblClickToZoom: false},
        gestureSettingsUnknown: {clickToZoom: false, dblClickToZoom: false},
        zoomPerClick: 1.4,
        constrainDuringPan: true,
        visibilityRatio: 1,
        showNavigationControl: true,
        //imageSmoothingEnabled: false,
        sequenceMode: false, // true,
        preserveViewport: true,
        preserveOverlays: true,
        preload: true
    };

    //Just default values
    const _imageState = {
        z: 0, // stepsize 1, zero in the middle (rounded down)
        brightness: 0,
        contrast: 0,
        transparency: 0
    }

    let _currentImage,
        _images, //All images in the data directory
        _collab,
        _viewer=null, //This is the main viewer, with overlays
        _viewers=[], //Array of all viewers, in z-index order, first is on top
        _imageStates=[], //Array of _imageState
        _disabledControls,
        _availableZLevels,
        _mouseHandler,
        _currentMouseUpdateFun=null;
        
    const _currState = {
            x: 0.5,
            y: 0.5,
            z: 0, //copied from _imageStates[_viewerIndex()].z
            rotation: 0,
            zoom: 1
        },
        _cursorStatus = {
            x: 0.5,
            y: 0.5,
            held: false,
            inside: false
        }


    //Index of _viewer
    function _viewerIndex() {
        return _viewers.findIndex(v => v === _viewer);
    }

    //z = index-ofs
    function _setFocusLevel(z,v=_viewers[0]) {
        const count = v.world.getItemCount();
        const ofs = Math.floor(count / 2);
        z = Math.min(Math.max(z,-ofs),count-1-ofs);
        setFocusIndex(z+ofs,v);
    }
    function getFocusIndex(v=_viewers[0]) {
        return v? v.getFocusIndex(): 0;
    }
    function setFocusIndex(z0,v=_viewers[0]) {
        v && v.setFocusIndex(z0);
        _updateFocus();
    }

    function _updateFocus() {
        if (!_viewer) {
            throw new Error("Tried to update focus of nonexistent viewer.");
        }
        const vi=_viewerIndex();
        _viewers.forEach((v,i) => {
            const ofs = Math.floor(v.world.getItemCount() / 2);
            const index = getFocusIndex(v);
            _imageStates[i].z = index-ofs;
            htmlHelper.updateFocusSlider(v,index); 
            htmlHelper.setFocusSliderOpacity(v,i==0?0.8:0.5);

            if (i==vi) {
                _currState.z = index-ofs;
                tmappUI.setImageZLevel(_currentImage.zLevels[index]); //Write in UI
                coordinateHelper.setImage(_viewer.world.getItemAt(index)); 
                _updateCollabPosition();
                _updateURLParams();
            }
        });
    }

    function setTransparency(t) {
        _imageStates[0].transparency = t;
        _updateTransparency();
    }

    function setBrightness(b) {
        _imageStates[0].brightness = b;
        _updateBrightnessContrast();
    }

    function setContrast(c) {
        _imageStates[0].contrast = c;
        _updateBrightnessContrast();
    }

    // This function should move elsewhere
    function _updateStateSliders() {
        $("#transparency_slider").slider('setValue', _imageStates[0].transparency);
        $("#brightness_slider").slider('setValue', _imageStates[0].brightness);
        $("#contrast_slider").slider('setValue', _imageStates[0].contrast);
    }

    /**
     * Apply _currState brightness/contrast to current viewer
     */
    function _updateBrightnessContrast() {
        //const ctx=_viewer.drawer.context;
        //Since I'm not 100% sure that Safari supports the above
        // https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/filter
        //we use the css-style property instead
        const ctx=_viewers[0].element.querySelector('.openseadragon-canvas').querySelector('canvas').style;
        if (_imageStates[0].contrast==0 && _imageStates[0].brightness==0) {
            ctx.filter = 'none';
        }
        else {
            ctx.filter = `brightness(${Math.pow(2,2*_imageStates[0].brightness)}) contrast(${Math.pow(4,_imageStates[0].contrast)})`;
        }
        //_viewer.world.draw(); //not needed
    }

    function _updateTransparency() {
        //See comment in _updateBrightnessContrast
        // const canvas = _viewers[0].element.querySelector('.openseadragon-canvas').querySelector('canvas');
        // const ctx = canvas.getContext("2d");
        // ctx.globalAlpha = 1-_currState.transparency; 

        //const ctx=_viewers[0].element.querySelector('.openseadragon-canvas').querySelector('canvas').style;
        //Make whole viewer transparent
        const ctx=_viewers[0].element.style;
        ctx.opacity = 1-_imageStates[0].transparency; 
    }

    // Must wait for "open" event
    function _setWarp(v,transform) {
        //update additional viewers
        const scale = (a,b) => ({x:a.x*b, y:a.y*b});

        console.log('WARP: ',v.transform,v.viewport.getZoom(),v,_viewer);
        const width0 = _viewer.world.getItemAt(0).source.dimensions.x;
        const width1 = v.world.getItemAt(0).source.dimensions.x;
        console.log(width0,':',width1,':',width1/width0);

        v.transform.scale = transform.scale*width1/width0; //Scale around upper left corner (before translation)
        v.transform.position = scale(transform.position,-1/width0/v.transform.scale);
        v.transform.rotation = transform.rotation; //Rotation around top left of _viewer (after scale and translate) 

        console.log(v.transform);
        _updateRotation();
        _updateZoom();
    }

    function _updateZoom(e) {
        if (!_viewer) {
            throw new Error("Tried to update zoom of nonexistent viewer.");
        }
        if (e && e.eventSource!==_viewer) { //ignore events from other viewers
            return;
        }

        const zoom = _viewer.viewport.getZoom();
        const maxZoom = _viewer.viewport.getMaxZoom();
        const size = _viewer.viewport.getContainerSize();
        overlayHandler.setOverlayScale(zoom, maxZoom, size.x, size.y);
        tmappUI.setImageZoom(Math.round(zoom*10)/10);
        _currState.zoom = zoom;

//console.log('zoom',zoom);

        //update additional viewers
        _viewers.forEach(v => {
            if (v===_viewer) {
                return;
            }
            if (v.freeze) {
                v.transform.scale=v.viewport.getZoom()/zoom;
                console.log('Scale: ',v.transform.scale);
            }
            v.viewport.zoomTo(zoom*v.transform.scale); //NOP if frozen
        });

        // Zooming often changes the position too, based on cursor position
        _updatePosition();
    }

    function _updateResize(e) {
        if (!_viewer) {
            throw new Error("Tried to update position of nonexistent viewer.");
        }
        if (e && e.eventSource!==_viewer) { //ignore events from other viewers
            return;
        }
        new Promise(resolve => setTimeout(resolve, 0)) //Crock! Fixme!
        .then(() => {
            _updatePosition(e);
        });
    }

    function _updatePosition(e) {
        if (!_viewer) {
            throw new Error("Tried to update position of nonexistent viewer.");
        }
        if (e && e.eventSource!==_viewer) { //ignore events from other viewers
            return;
        }

        const position = _viewer.viewport.getCenter();
        _currState.x = position.x;
        _currState.y = position.y;

//console.log('pos',position);

        //update additional viewers
        const plus = (a,b) => ({x:a.x+b.x, y:a.y+b.y});
        const minus = (a,b) => ({x:a.x-b.x, y:a.y-b.y});
        const scale = (a,s) => ({x:a.x*s, y:a.y*s});
        const deg2rad = (r) => (r*Math.PI/180);
        const rotate = (a,r) => ({x:a.x*Math.cos(r)+a.y*Math.sin(r), y:-a.x*Math.sin(r)+a.y*Math.cos(r)});
        _viewers.forEach(v => {
            if (v===_viewer) {
                return;
            }
            let scaledPosition=scale(position,1/v.transform.scale);
            scaledPosition=rotate(scaledPosition,deg2rad(v.transform.rotation));
            if (v.freeze) {
                v.transform.position=minus(v.viewport.getCenter(),scaledPosition);
                console.log('Position: ',v.transform.position);
            }
            const newPos = plus(scaledPosition,v.transform.position);
            v.viewport.panTo(newPos); //NOP if frozen
        });

        _updateCollabPosition();
        _updateURLParams();
    }

    function _updateRotation(e) {
        if (!_viewer) {
            throw new Error("Tried to update rotation of nonexistent viewer.");
        }
        if (e && e.eventSource!==_viewer) { //ignore events from other viewers
            return;
        }

        const rotation = _viewer.viewport.getRotation();
        overlayHandler.setOverlayRotation(rotation);
        tmappUI.setImageRotation(rotation);
        _currState.rotation = rotation;

        //update additional viewers
        _viewers.forEach(v => {
            if (v===_viewer) {
                return;
            }
            if (v.freeze) { //This bugs, need to update position as well
                v.transform.rotation=v.viewport.getRotation()-rotation;
                console.log('Rotation: ',v.transform.rotation);
            }
            v.viewport.setRotation(rotation+v.transform.rotation); //NOP if frozen
        });

        _updateCollabPosition();
        _updateURLParams();
    }

    const roundTo = (x, n) => Math.round(x * Math.pow(10, n)) / Math.pow(10, n);
    let urlCache=null;
    function makeURL({x, y, z, rotation, zoom}={},update=false) {
        const url = (update&&urlCache)?urlCache:new URL(window.location.href);
        const params = url.searchParams;
        if (_currentImage) {
            update || params.set("image", _currentImage.name);
            zoom!=null && params.set("zoom", roundTo(zoom, 2));
            x!=null && params.set("x", roundTo(x, 5));
            y!=null && params.set("y", roundTo(y, 5));
            z!=null && params.set("z", z);
            rotation!=null && params.set("rotation", rotation||0);
        }
        update || (_collab ? params.set("collab", _collab) : params.delete("collab"));
        urlCache=url;
        return url;
    }
    
    function parseURL(url) {
        if (!(url instanceof URL)) {
            url=new URL(url);
        }
        // Get params from URL
        const params = url.searchParams;
        const imageName = params.get("image");
        const collab = params.get("collab");
        const state = {
            zoom: params.get("zoom"),
            x: params.get("x"),
            y: params.get("y"),
            z: params.get("z"),
            rotation: params.get("rotation")
        };
        return {imageName, collab, state};
    }

    function processURL(url) {
        const {imageName, collab, state}=parseURL(url);
        if (imageName && imageName!==_currentImage.name) {
            if (collab) {
                openImage(imageName, () => {
                    collabClient.connect(collab);
                    if (state) {
                        moveTo(state);
                    }
                });
            }
            else if (imageName) {
                openImage(imageName, () => {
                    collabPicker.open(imageName, true, true, () => {
                        if (state) {
                            moveTo(state);
                        }
                    });
                });
            }            
        }
        else if (collab && collab!==_collab) {
            collabClient.connect(collab);
            if (state) {
                moveTo(state);
            }
        }
        else if (state && state!==_currState) {
            moveTo(state);
        }
    }

    function _updateURLParams() {
        tmappUI.setURL(makeURL(_currState));
    }

    let _navigatorTimeout = 0;
    function _unhideNavigator(inside) {
        const _navigatorTime = 10 * 1000; //10s
        _viewer.navigator.element.style.transitionDuration = "100ms";
        _viewer.navigator.element.style.opacity = _viewer.navigatorOpacity;
        if (_navigatorTimeout) {
            clearTimeout(_navigatorTimeout);
        }
        if (!inside) {
            _navigatorTimeout = setTimeout(() => { 
                _viewer.navigator.element.style.transitionDuration = "2s";
                _viewer.navigator.element.style.opacity = 0; 
            }, _navigatorTime );    
        }
    }

    let _toolbarTimeout = 0;
    function _unhideToolbar(inside) {
        //const elem=_viewer.toolbar.element;
        //Cannot set opacity<1 on "toolbar_div" due to z-index stacking context
        const elem=[document.getElementById("toolbar_subdiv")]; //,document.getElementById("toolbar_sliderdiv")];
        const _toolbarTime = _viewer.controlsFadeDelay;
        for (const e of elem) e.style.transitionDuration = "100ms";
        for (const e of elem) e.style.opacity = 1;
        if (_toolbarTimeout) {
            clearTimeout(_toolbarTimeout);
        }
        if (!inside) {
            _toolbarTimeout = setTimeout(() => { 
                for (const e of elem) e.style.transitionDuration = `${_viewer.controlsFadeLength}ms`;
                for (const e of elem) e.style.opacity = 0; 
            }, _toolbarTime );    
        }
    }
    
    function _updateCollabPosition() {
        _unhideNavigator();
        collabClient.updatePosition(_currState);
    }

    function _updateCollabCursor() {
        collabClient.updateCursor(_cursorStatus);
    }

    /** Filename convention hardcoded here! FIX */
    function _expandImageName(imageInfo) {
        // Get the full image names based on the data from the server
        const imageName = imageInfo.name;
        const zLevels = imageInfo.zLevels;
        const imageStack = zLevels.map(zLevel => {
            return `${_imageDir}${imageName}_z${zLevel}.dzi`;
        });
        return imageStack;
    }

    function _imageWarpName(imageName) {
        return `${_imageDir}${imageName}_warp.json`;
    }

    function _openImages(viewer,imageStack) {
        const initialZ = 0;
        const offset = Math.floor(imageStack.length / 2);
        const zLevels = Array.from({length: imageStack.length}, (x, i) => i - offset);
        _availableZLevels = zLevels;
        viewer.openFocusLevels(imageStack, initialZ, zLevels);
        _imageStates[0].z = initialZ;
        _currState.z = initialZ;
    }

    /**
     * Add handlers for mouse events in the OSD viewer. This includes
     * making calls to the annotationTool module when clicking or double
     * clicking, sending updates to collabClient when the mouse is moved
     * inside the viewport, as well as taking care of the shift and ctrl
     * scrolling to change focus and rotation.
     */
    function _addMouseTracking(viewer) {
        let mouse_pos; //retain last used mouse_pos (global) s.t. we may update locations when keyboard panning etc.
        
        // Handle quick and slow clicks
        function clickHandler(event) {
            let regionWasBeingEdited = true;
            if (tmappUI.inFocus() && event.quick) {
                regionWasBeingEdited = regionEditor.stopEditingRegion();
            }
            if(!regionWasBeingEdited && event.quick && !event.ctrlKey && tmappUI.inFocus()){
                const coords = coordinateHelper.webToViewport(event.position);
                const position = {
                    x: coords.x,
                    y: coords.y,
                    z: _currState.z
                };
                setCursorStatus(position);
                annotationTool.click(position);
            }
        };

        // Note, a dblClick triggers: click+click+dblClick
        function dblClickHandler(event) {
            if(!event.ctrlKey && tmappUI.inFocus()){
                const coords = coordinateHelper.webToViewport(event.position);
                const position = {
                    x: coords.x,
                    y: coords.y,
                    z: _currState.z
                };
                setCursorStatus(position);
                annotationTool.dblClick(position);
            }
        };

        // Similar naming convention as in overlayHandler
        function updateMousePos() {
            if (!_cursorStatus.held) { // Drag does not change location in image
                const pos = coordinateHelper.webToViewport(mouse_pos);
                setCursorStatus({x: pos.x, y: pos.y});
            }
        }

        // Live updates of mouse position in collaboration
        // Store event to re-dispatch on viewport-change
        function moveHandler(event) {
            mouse_pos = event.position;
            updateMousePos();
            _currentMouseUpdateFun = updateMousePos;
        }

        // Live updates of whether or not the mouse is held down
        function heldHandler(held) {
            return function(event) {
//                console.log('OSD: ',event.originalEvent.defaultPrevented, event);
                setCursorStatus({held: held});
            };
        }

        // Live update of whether or not the mouse is in the viewport
        function insideHandler(inside) {
            return function(event) {
                setCursorStatus({inside: inside});
            };
        }

        //OSD handlers have to be registered using MouseTracker OSD objects
        _mouseHandler = new OpenSeadragon.MouseTracker({
            element: viewer.canvas,
            clickHandler: clickHandler,
            dblClickHandler: dblClickHandler,
            moveHandler: moveHandler,
            enterHandler: insideHandler(true),
            exitHandler: insideHandler(false),
            pressHandler: heldHandler(true),
            releaseHandler: heldHandler(false)
        }).setTracking(true);

        // Add hook to scroll without zooming
        function scrollHook(event){
            console.assert(event.scroll); //scroll without scroll?!
            if (event.originalEvent.ctrlKey) {
                event.preventDefaultAction = true;
                if (event.scroll > 0) {
                    incrementFocus();
                }
                else if (event.scroll < 0) {
                    decrementFocus();
                }
            }
            else if (event.originalEvent.shiftKey) {
                event.preventDefaultAction = true;
                let rotation = _currState.rotation;
                const rotationPerScroll = event.originalEvent.altKey? 0.1: 15; //ALT for small rotation
                rotation += (event.scroll>0? 1:-1) * rotationPerScroll;
                rotation = mathUtils.roundDecimals(rotation%360,2); //avoid long floating point .9999999 situations
                _viewer.viewport.setRotation(rotation);

                // _viewer.viewport.rotateBy(event.scroll>0? +15: -15); //needs newer OSD!
            }
            else if (event.originalEvent.altKey) {
                viewer.zoomPerScroll = 1.01;
            }
            else {
                viewer.zoomPerScroll = 1.3;
            }
        };

        viewer.addViewerInputHook({hooks: [
            {
                tracker: "viewer",
                handler: "scrollHandler",
                hookHandler: scrollHook
            }
        ]});
    }

    
    function _addHandlers(viewer, image, callback, activeViewer=true) {
        if (activeViewer) { 
            // Change-of-Page (z-level) handler
            viewer.addHandler("page", _updateFocus);
            viewer.addHandler("zoom", _updateZoom);
            viewer.addHandler("pan", _updatePosition);
            viewer.addHandler("rotate", _updateRotation);
            viewer.addHandler("resize", _updateResize);
        }

        // When we're done loading
        viewer.addHandler("open", function (event) {
            console.info("Done loading!");

            //Load warp if existing
            const warpName=_imageWarpName(image.name);
            promiseHttpRequest("GET", warpName)
                .then(JSON.parse)
                .then(result=>_setWarp(viewer,result))
                .catch((e)=>console.log('Warp: ',e));

            //Focus slider
            htmlHelper.addFocusSlider($("#toolbar_sliderdiv"),image.zLevels,viewer);
                        
            if (activeViewer) {
                _addMouseTracking(viewer);

                const imageFL = _images.find(image => image.name === _currentImage.name+'_FL');
                if (imageFL) {
                    addImage(imageFL.name);
                }
            }
            viewer.canvas.focus();
            viewer.viewport.goHome();
            _updateZoom();
            _updateFocus();
            _updatePosition();
            _updateRotation();
            _updateBrightnessContrast();
            tmappUI.clearImageError();
            callback && callback();
        });

        // Error message if we fail to load
        viewer.addHandler('open-failed', function (event) {
            console.warn("Open failed!");
            tmappUI.displayImageError("servererror");
        });

        // A tile failed to load
        viewer.addHandler("tile-load-failed", function(event) {
            tmappUI.displayImageError("tilefail", 1000);
        });

        // What is the difference between 'update-viewport' and 'viewport-change' ?
        viewer.addHandler('viewport-change', (event) => {
            _currentMouseUpdateFun && _currentMouseUpdateFun(); //set cursor position if view-port changed by external source
        });
    }

    /**
     * Initialize an instance of OpenSeadragon. 
     * Creating the DOM node for the viewer.
     * Getting a full stack of image names based on the original imageName, 
     * loading the images from the server, and initializing the overlay.
     * 
     * @param {string} imageName Name of the image to open.
     * @param {Function} callback Function to call once the images have
     * been successfully loaded.
     * @param {boolean} withOverlay, set true to associate annotation overlays
     * 
     * @returns {object} image object to store in _currentImage.
     */
    let _nextViewerId=0; // Running index of OSD-viewers
    function _newOSD(imageName, callback=null, withOverlay=true) {
        const image = _images.find(image => image.name === imageName);
        if (!image) {
            tmappUI.displayImageError("badimage");
            throw new Error(`Failed to open image ${imageName}.`);
        }

        console.log(`Opening ${image.name} -> image #${_nextViewerId} of ${_viewers.length+1}`);
        const idString=`viewer_${_nextViewerId}`;

        //Create html element for viewer
        document.querySelector('#viewer_container').insertAdjacentHTML(
            'afterbegin',
            `<div id="${idString}" class="ISS_viewer flex-grow-1 h-100 w-100"></div>`
        )

        //Create OSD viewer
        const options={..._optionsOSD};
        Object.assign(options,{
            id: idString,
            showNavigator: withOverlay, //For the moment we don't support multiple navigators
            showNavigationControl: withOverlay //For the moment we don't support multiple controls
        });
        const newViewer = OpenSeadragon(options);
        _nextViewerId++;
        newViewer.transform = {scale:1, position:{x:0, y:0}, rotation:0}; // Similarity transform 
        
        //Put first
        //_viewers.unshift(newViewer);
        _viewers.push(newViewer);
        _viewersOrder(); //Set z-index
        //_imageStates.unshift({..._imageState}); //Add new default state
        _imageStates.push({..._imageState}); //Add new default state
        _updateStateSliders();

        //open the DZI xml file pointing to the tiles
        const imageStack = _expandImageName(image);
        _openImages(newViewer,imageStack); //sets _availableZLevels

        //don't add more handlers than needed
        _addHandlers(newViewer, image, callback, withOverlay);
        if (withOverlay) {
            _viewer=newViewer; 
    
            const navigatorDiv = document.getElementById("navigator_div");
            navigatorDiv.addEventListener("pointerenter", () => _unhideNavigator(true));
            navigatorDiv.addEventListener("pointerleave", () => _unhideNavigator(false));

            const element = document.getElementById('annotation_layer');
            //const element = document.getElementById('viewer_container');
            //const element = _viewer.element;
            if (_viewer.autoHideControls) {
                element.addEventListener("pointerenter", () => _unhideToolbar(true));
                element.addEventListener("pointerleave", () => _unhideToolbar(false));
            }
            element.style.zIndex = 200;

            _viewer.scalebar(); 
            //https://github.com/usnistgov/OpenSeadragonScalebar/blob/master/openseadragon-scalebar.js
            element.append(_viewer.container.lastChild); //Relying on being added last!

            // element.style.pointerEvents = "none"; //ignore mouse :-)
            //forward all events from annotation_layer to _viewer.canvas
            htmlUtils.forwardEvents(element, _viewer.canvas);

            const overlay = _viewer.svgOverlay(element);
            const pixiOverlay = _viewer.pixiOverlay(element);
            overlayHandler.init(overlay,pixiOverlay);
        }
        else {
            newViewer.element.style.pointerEvents = "none"; //ignore mouse :-)
        }

        return image;
    }

    function _clearAllViewers() {
        while (_viewers.length) {
            const v = _viewers.pop();
            $("#"+v.id).empty(); //remove descendants of DOM node (alt. while (foo.firstChild) foo.removeChild(foo.firstChild); )
            v.element.remove(); //remove DOM node
            v.destroy();
        }
        _imageStates=[];
        _viewer=null;
        _mouseHandler.destroy();
    }
    function _clearCurrentImage() {
        if (!_viewer) {
            return;
        }
        annotationHandler.clear(false);
        metadataHandler.clear();
        coordinateHelper.clearImage();

        _clearAllViewers(); //currently not supporting partial clear
        $("#navigator_div").empty(); //not cleaned up by OSD destroy it seems
        $("#toolbar_sliderdiv").empty();
        _disabledControls = null;
        _availableZLevels = null;
    }

    function _filterImages(images) {
        console.log(images);
        return images.filter(img => !img.name.includes('_FL'));
    }

    /**
     * Initiate tmapp by fetching a list of images from the server,
     * filling the image browser, and going to the image specified
     * in the search parameters of the URL. If a collab and an initial
     * state are also specified in the URL, these are also set up.
     * @param {Object} options The initial tmapp options specified in
     * the URL.
     * @param {string} options.imageName The name of the initial image
     * to be opened.
     * @param {string} options.collab The id of the initial collab.
     * @param {Object} options.initialState The initial viewport state.
     * @param {number} options.initialState.x X position of viewport.
     * @param {number} options.initialState.y Y position of viewport.
     * @param {number} options.initialState.z Z level in viewport.
     * @param {number} options.initialState.zoom Zoom in viewport.
     */
    function init({imageName, collab, initialState}) {

        // Initiate a HTTP request and send it to the image info endpoint
        const imageReq = new XMLHttpRequest();
        imageReq.open("GET", window.location.api + "/images", true);
        // Turn off caching of response
        imageReq.setRequestHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0"); // HTTP 1.1
        imageReq.setRequestHeader("Pragma", "no-cache"); // HTTP 1.0
        imageReq.setRequestHeader("Expires", "0"); // Proxies

        imageReq.send(null);

        imageReq.onreadystatechange = function() {
            if (imageReq.readyState !== 4) {
                return;
            }
            tmappUI.setUserName(userInfo.getName());
            switch (imageReq.status) {
                case 200:
                    // Add the images to the image browser
                    const response = JSON.parse(imageReq.responseText);
                    const missingDataDir = response.missingDataDir;
                    const images = response.images;
                    
                    const filteredImages = _filterImages(images);
                    
                    tmappUI.updateImageBrowser(filteredImages);
                    _images = images;

                    // Go to the initial image and/or join the collab
                    if (missingDataDir) {
                        tmappUI.displayImageError("missingdatadir");
                    }
                    else if (images.length === 0) {
                        tmappUI.displayImageError("noavailableimages");
                    }
                    else if (imageName && collab) {
                        openImage(imageName, () => {
                            collabClient.connect(collab);
                            if (initialState) {
                                moveTo(initialState);
                            }
                        });
                    }
                    else if (imageName) {
                        openImage(imageName, () => {
                            collabPicker.open(imageName, true, true, () => {
                                if (initialState) {
                                    moveTo(initialState);
                                }
                            });
                        });
                    }
                    else {
                        tmappUI.displayImageError("noimage");
                        $("#image_browser").modal();
                    }
                    break;
                case 500:
                    tmappUI.displayImageError("servererror");
                    break;
                default:
                    tmappUI.displayImageError("unexpected");
            }
        }
    }

    /**
     * Open a specified image in the viewport. If annotations have been
     * placed, the user is first prompted to see if they actually want
     * to open the image or if they want to cancel.
     * @param {string} imageName The name of the image being opened. If
     * the image name is falsy, the current image will be closed.
     * @param {Function} callback Function to call if and only if the
     * image is successfully opened, before the viewport is moved.
     * @param {Function} nochange Function to call if the user is
     * prompted on whether or not they want to change images and they
     * decide not to change.
     * @param {boolean} askAboutSaving If the user has ended up outside
     * of a collaboration and tries to swap images, this prompts them
     * if they want to stay on the image so they can save their progress
     * manually.
     */
    function openImage(imageName, callback, nochange, askAboutSaving=false) {
        if (!annotationHandler.isEmpty() && !_collab && askAboutSaving &&
            !confirm(`You are about to open ` +
            `the image "${imageName}". Do you want to ` +
            `open this image? Any annotations placed on the ` +
            `current image will be lost unless you save ` +
            `them first.`)) {
            nochange && nochange();
            return;
        }

        if (!imageName) {
            _clearCurrentImage();
            _currentImage = null;
            tmappUI.setImageName(null);
            tmappUI.displayImageError("noimage");
            _updateURLParams();
            callback && callback();
        }
        else {
            _clearCurrentImage(); //yes, previously we checked for valid name before clearing, but...
            _currentImage = _newOSD(imageName, callback);
            tmappUI.setImageName(_currentImage.name);
            _updateURLParams();
        }
    }

    /**
     * Similar to openImage, but adding instead of replacing
     * @param {string} imageName The name of the image being opened.
     */
    function addImage(imageName, callback) {
        _newOSD(imageName,callback,false); //no overlay
    }

    /**
     * Move to a specified state in the viewport. If the state is only
     * partially defined, the rest of the viewport state will remain
     * the same as it was.
     * @param {Object} state The viewport state to move to.
     * @param {number} state.x The x position of the viewport.
     * @param {number} state.y The y position of the viewport.
     * @param {number} state.z The z level in the viewport.
     * @param {number} state.rotation The rotation in the viewport.
     * @param {number} state.zoom The zoom in the viewport.
     */
    function moveTo({x, y, z, rotation, zoom}) {
        const capValue = (val, min, max) => Math.max(Math.min(val, max), min);
        if (!_viewer) {
            throw new Error("Tried to move viewport without a viewer.");
        }
        if (zoom !== undefined) {
            const min = _viewer.viewport.getMinZoom();
            const max = _viewer.viewport.getMaxZoom();
            const boundZoom = capValue(zoom, min, max);
            _viewer.viewport.zoomTo(boundZoom, true);
        }
        if (x !== undefined && y !== undefined) {
            const imageBounds = _viewer.world.getItemAt(0).getBounds();
            const viewportBounds = _viewer.viewport.getBounds();
            let minX = viewportBounds.width / 2;
            let minY = viewportBounds.height / 2;
            let maxX = imageBounds.width - viewportBounds.width / 2;
            let maxY = imageBounds.height - viewportBounds.height / 2;
            if (minX > maxX) {
                minX = imageBounds.width / 2;
                maxX = imageBounds.width / 2;
            }
            if (minY > maxY) {
                minY = imageBounds.height / 2;
                maxY = imageBounds.height / 2;
            }
            const boundX = capValue(x, minX, maxX);
            const boundY = capValue(y, minY, maxY);
            const point = new OpenSeadragon.Point(boundX, boundY);
            _viewer.viewport.panTo(point, true);
        }
        if (rotation !== undefined) {
            _viewer.viewport.setRotation(rotation);
        }
        if (z !== undefined) {
            _setFocusLevel(z);
        }
    }

    function _defaultZoom(annotation) {
        const img_diag = _viewer.world.getItemAt(0).getContentSize().distanceTo(new OpenSeadragon.Point());
        return Math.pow(0.5*img_diag/(600+annotation.diameter),0.9);
    }

    // Bundle position of an annotation, for moveTo and URL
    function _defaultLocation(annotation) {
        const target = coordinateHelper.imageToViewport(annotation.centroid);
        return {
            zoom: _defaultZoom(annotation),
            x: target.x,
            y: target.y,
            z: annotation.z
        }
    }

    /**
     * Move the viewport to look at a specific annotation.
     * @param {number} x The annottation or its id where to move.
     *
     * Note: getAnnotationById is currently O(N) slow!
     */
    function moveToAnnotation(x) {
        // Only move if you're not following anyone
        if (_disabledControls) {
            console.warn("Can't move to annotation when following someone.");
            return;
        }

        const annotation = (x.id != null)? x: annotationHandler.getAnnotationById(x);
        if (annotation === undefined) {
            console.log(`Got input: ${x}`, x);
            throw new Error("Tried to move to an unused annotation id.");
        }
        moveTo(_defaultLocation(annotation));
    }

    /**
     * Create URL pointing to view of a specific annotation.
     * @param {number} x The annottation or its id where to move.
     *
     * Note: getAnnotationById is currently O(N) slow!
     */
    function annotationURL(x, update=false) {
        const annotation = (x.id != null)? x: annotationHandler.getAnnotationById(x);
        if (annotation === undefined) {
            console.log(`Got input: ${x}`, x);
            throw new Error("Tried to get URL of an unused annotation id.");
        }
        
        return makeURL(_defaultLocation(annotation),update);
    }

    /**
     * Set the current collaboration id, update the URL parameters and
     * set the appropriate URL parameters.
     @param {string} id The collaboration id being set.
     */
    function setCollab(id) {
        _collab = id;
        tmappUI.setCollabID(id, _currentImage.name);
        _updateURLParams();
    }

    /**
     * Clear the currently set collaboration and update the URL parameters.
     */
    function clearCollab() {
        _collab = null;
        tmappUI.clearCollabID();
        _updateURLParams();
    }

    /**
     * Increment the Z level by 1, if possible.
     */
    function incrementFocus() {
        if (!_disabledControls) {
            _setFocusLevel(_imageStates[0].z + 1);
        }
    }

    /**
     * Decrement the Z level by 1, if possible.
     */
    function decrementFocus() {
        if (!_disabledControls) {
            _setFocusLevel(_imageStates[0].z - 1);
        }
    }

    /**
     * Get the available z levels for the current image.
     * @returns {Array} An array of the available z levels.
     */
    function getZLevels() {
        return _availableZLevels ? _availableZLevels : [];
    }

    

    /**
     * Get the name of the currently opened image.
     * @returns {string} The current image name.
     */
    function getImageName() {
        return _currentImage && _currentImage.name;
    }

    /**
     * Update the current status of tmapp, viewport position and cursor
     * position, to the collaborators.
     */
    function updateCollabStatus() {
        _updateCollabCursor();
        _updateCollabPosition();
    }

    /**
     * Set the current status of the mouse cursor in the OpenSeadragon
     * viewport and update it for collaborators. Only the parameters
     * present in the parameters will be updated, the others will remain
     * as they were.
     * @param {Object} status The updated status parameters.
     * @param {number} [status.x] The x position of the cursor, in
     * OSD viewport coordinates.
     * @param {number} [status.y] The y position of the cursor, in
     * OSD viewport coordinates.
     * @param {boolean} [status.held] Whether or not the left mouse
     * button is held down.
     * @param {boolean} [status.inside] Whether or not the cursor is
     * inside the OpenSeadragon viewport.
     */
    function setCursorStatus(status) {
        Object.assign(_cursorStatus, status);
        const position = {
            x: _cursorStatus.x,
            y: _cursorStatus.y,
            z: _currState.z
        };
        annotationTool.updateMousePosition(position);
        _updateCollabCursor();
    }

    /**
     * Enable all control over the viewport state.
     */
    function enableControls() {
        if (!_disabledControls) {
            return;
        }
        _viewer.setMouseNavEnabled(true);
        _disabledControls.forEach(control => {
            _viewer.addControl(control.element, control);
        });
        _disabledControls = null;
    }

    /**
     * Disable all control over the viewport state.
     */
    function disableControls() {
        if (_disabledControls) {
            return;
        }
        _viewer.setMouseNavEnabled(false);

        // Store a copy of the current control buttons
        // API docs suggest setControlsEnabled(), doesn't seem to work
        _disabledControls = Array.from(_viewer.controls);
        _viewer.clearControls();
    }

    /**
     * Sending events to OSDs keyboard handlers
     */
    function keyDownHandler(event) {
        // Only arrow keys
        _viewer.innerTracker.keyDownHandler(event);
    }
    function keyHandler(event) {
        // All other OSD keys
        _viewer.innerTracker.keyHandler(event);
    }
    function mouseHandler() {
        return _mouseHandler;
    }

    /**
     * Update the scale of the scalebar.
     * @param {number} pixelsPerMeter The number of pixels in one meter.
     */
    function updateScalebar(pixelsPerMeter) {
        // Uses: https://github.com/usnistgov/OpenSeadragonScalebar
        if (_viewer) {
            _viewer.scalebar({
                pixelsPerMeter: pixelsPerMeter,
                type: OpenSeadragon.ScalebarType.MICROSCOPY,
                location: OpenSeadragon.ScalebarLocation.BOTTOM_RIGHT,
                backgroundColor: "rgba(255,255,255,0.5)",
                barThickness: 4,
                stayInsideImage: false // Necessary for rotation to work
            });
        }
        else {
            throw new Error ("Tried to adjust scalebar without a viewer.");
        }
    }

    function _viewersOrder() {
        _viewers.forEach((v,i) => v.element.style.zIndex = 100-i);
    }
    function _viewerSwap(i,j) {
        _viewers[i].element.style.zIndex = 100-j;
        _viewers[j].element.style.zIndex = 100-i;
        [ _viewers[j], _viewers[i] ] = [ _viewers[i], _viewers[j] ];
        [ _imageStates[j], _imageStates[i] ] = [ _imageStates[i], _imageStates[j] ];
        _updateStateSliders();
        _updateFocus();
    }
    function viewerBringForward(idx) {
        if (idx>0) {
            _viewerSwap(idx, idx-1);
        }
    }
    function viewerBringToFront(idx) {
        if (idx>0) {
            _viewers.unshift(_viewers.splice(idx,1)[0]);
            _imageStates.unshift(_imageStates.splice(idx,1)[0]);
            _viewersOrder();
            _updateStateSliders();
            _updateFocus();
        }
    }
    function viewerSendBackward(idx) {
        if (idx<_viewers.length-1) {
            _viewerSwap(idx, idx+1);
        }
    }
    function viewerSendToBack(idx) {
        if (idx<_viewers.length-1) {
            _viewers.push(_viewers.splice(idx,1)[0]);
            _imageStates.push(_imageStates.splice(idx,1)[0]);
            _viewersOrder();
            _updateStateSliders();
            _updateFocus();
        }
    }
    function viewerFreeze(val) {
        _viewers[0].freeze=val;
    }

    return {
        init,
        openImage,

        moveTo,
        moveToAnnotation,
        
        makeURL,
        parseURL,
        processURL,
        annotationURL,

        setCollab,
        clearCollab,

        incrementFocus,
        decrementFocus,
        getZLevels,
        setFocusIndex,
        getFocusIndex,

        setBrightness,
        setContrast,
        setTransparency,

        getImageName,
        getViewerId:()=>_viewer.id,
        updateCollabStatus,
        setCursorStatus,
        enableControls,
        disableControls,

        keyHandler,
        keyDownHandler,
        mouseHandler,

        updateScalebar,

        addImage,

        viewerBringForward,
        viewerBringToFront,
        viewerSendBackward,
        viewerSendToBack,

        viewerFreeze
    };
})();

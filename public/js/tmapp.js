/**
 * Functions related to interaction with the OpenSeadragon viewer, including
 * initialization, image information, updating the current URL state, etc.
 * @namespace tmapp
 */
const tmapp = (function() {
    "use strict";

    const _imageDir = "data/";
    const _optionsOSD = {
        id: "viewer_0", //cybr_viewer
        prefixUrl: "js/openseadragon/images/", //Location of button graphics
        showNavigator: true,
        navigatorPosition: "BOTTOM_LEFT",
        navigatorSizeRatio: 0.3,
        navigatorMaintainSizeRatio: true, 
        animationTime: 0.0,
        blendTime: 0.3,
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
        preload: true
    };

    //Just default values
    const _imageState = {
        z: 0, // stepsize 1, zero in the middle (rounded down)
        brightness: 0,
        contrast: 0,
        transparency: 0
    }

    let _currentImage = null, //the main focus stack (shown in _viewer)
        _images, //All images in the data directory
        _collab,
        _viewer=null, //This is the main viewer, with overlays
        _viewers=[], //Array of all viewers, in z-index order, first is on top
        _imageStates=[], //Array of _imageState
        _disabledControls=false, //showing controls and navigator
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
        const count = v.nFocusLevels;
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

    // Set slider and which z-image to view based on focusIndex
    function _updateFocus() {
        if (!_viewer) {
            throw new Error("Tried to update focus of nonexistent viewer.");
        }
        const vi=_viewerIndex();
        _viewers.forEach((v,i) => {
            const ofs = Math.floor(v.nFocusLevels / 2);
            const index = getFocusIndex(v);
            _imageStates[i].z = index-ofs;
            htmlHelper.updateFocusSlider(v,index); 
            htmlHelper.setFocusSliderOpacity(v,i==0?0.9:0.5);
            htmlHelper.enableFocusSlider(v,i==0);

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

    function _updateStateSliders(imageState=_imageStates[0]) {
        $("#transparency_slider").slider('setValue', imageState.transparency);
        $("#brightness_slider").slider('setValue', imageState.brightness);
        $("#contrast_slider").slider('setValue', imageState.contrast);
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
        const scale = (a,b) => ({x:a.x*b, y:a.y*b});

        //Scale around upper left corner (before translation)
        //Position in image pixels
        //Rotation around top left of _viewer (after scale and translate) 

        v.transform=transform; //Possibly extend to array(sequence) of transforms
        v.transform.position=scale(v.transform.position,-1);
        //v.transform.disabled=true;
        moveTo(_currState);
    }

    /**
     * Handler called when we change zoom from OSD
     */
    function _updateZoom(e) {
        if (!_viewer) {
            throw new Error("Tried to update zoom of nonexistent viewer.");
        }
        if (e && e.eventSource!==_viewer) { //ignore events from other viewers
            console.warn('Got zoom event from other viewer');
            return;
        }

        let zoom = _viewer.viewport.getZoom();
        if (_viewer.transform?.scale && !_viewer.transform?.disabled) {
            zoom /= _viewer.transform.scale; // Viewer scale is just adjusting the zoom value
        }
        const maxZoom = _viewer.viewport.getMaxZoom();
        const size = _viewer.viewport.getContainerSize();
        layerHandler.setZoom(zoom, maxZoom, size.x, size.y);
        tmappUI.setImageZoom(Math.round(zoom*10)/10);
        _currState.zoom = zoom;

        //Into pixel-scale-factor
        zoom = _viewer.world.getItemAt(0).viewportToImageZoom(zoom);

        //update additional viewers
        _viewers.forEach(v => {
            if (v===_viewer || !v.world.getItemAt(0)) {
                return;
            }
        
            let newZoom = zoom;
            if (v.transform?.scale && !v.transform?.disabled) {
                newZoom *= v.transform.scale;
            }
            newZoom = v.world.getItemAt(0).imageToViewportZoom(newZoom);
            v.viewport.zoomTo(newZoom);
        });

        // Zooming often changes the position too, based on cursor position
        _updatePosition();
    }

    /**
     * Handler called when we pan in OSD
     */
    function _updatePosition(e) {
        if (!_viewer) {
            throw new Error("Tried to update position of nonexistent viewer.");
        }
        if (e && e.eventSource!==_viewer) { //ignore events from other viewers
            console.warn('Got position event from other viewer');
            return;
        }

        const plus = (a,b) => ({x:a.x+b.x, y:a.y+b.y});
        const minus = (a,b) => ({x:a.x-b.x, y:a.y-b.y});
        const scale = (a,s) => ({x:a.x*s, y:a.y*s});
        const deg2rad = (r) => (r*Math.PI/180);
        const rotate = (a,r) => ({x:a.x*Math.cos(r)+a.y*Math.sin(r), y:-a.x*Math.sin(r)+a.y*Math.cos(r)});
    
        let position = _viewer.viewport.getCenter();
        if (_viewer.transform?.position && !_viewer.transform?.disabled) {
            position = minus(position,_viewer.transform.position);
        }
        _currState.x = position.x;
        _currState.y = position.y;

        //Into image coords
        position = _viewer.world.getItemAt(0).viewportToImageCoordinates(position);

        //update additional viewers
        _viewers.forEach(v => {
            if (v===_viewer || !v.world.getItemAt(0)) {
                return;
            }

            let newPos = position;
            if (v.transform?.position && !v.transform?.disabled) {
                newPos = plus(newPos,v.transform.position); //Displace in _viewer (image) coords
            }
            if (v.transform?.scale && !v.transform?.disabled) {
                newPos = scale(newPos,1/v.transform.scale); //Scale to v (image) coords
            }
            if (v.transform?.rotation && !v.transform?.disabled) {
                newPos=rotate(newPos,deg2rad(v.transform.rotation)); //Rotate around origin
            }
            newPos = v.world.getItemAt(0).imageToViewportCoordinates(newPos.x,newPos.y); 
            v.viewport.panTo(newPos);
        });

        _updateCollabPosition();
        _updateURLParams();
    }


    /**
     * Handler called for shift-scroll in OSD
     */
    function _updateRotation(e) {
        if (!_viewer) {
            throw new Error("Tried to update rotation of nonexistent viewer.");
        }
        if (e && e.eventSource!==_viewer) { //ignore events from other viewers
            console.warn('Got rotation event from other viewer');
            return;
        }

        let rotation = _viewer.viewport.getRotation();
        if (_viewer.transform?.rotation && !_viewer.transform?.disabled) {
            rotation -= _viewer.transform.rotation; // Viewer rotation is just an offset
        }
        layerHandler.setRotation(rotation);
        tmappUI.setImageRotation(rotation);
        _currState.rotation = rotation;

        //update additional viewers
        _viewers.forEach(v => {
            if (v===_viewer) {
                return;
            }
            let newRot = rotation;
            if (v.transform?.rotation && !v.transform?.disabled) {
                newRot += v.transform.rotation;
            }
            v.viewport.setRotation(newRot);
        });

        _updateCollabPosition();
        _updateURLParams();
    }


    /**
     * Create URL which encodes our state
     */
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
                collabPicker.open(imageName, true, true, () => {
                    if (state) {
                        moveTo(state);
                    }
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
        //console.log('UpdateURLS',_currState);
        tmappUI.setURL(makeURL(_currState));
    }

    function _updateCollabPosition() {
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
        console.log('Name:',imageName);
        return `${_imageDir}${imageName}_warp.json`;
    }

    function _openImages(viewer,imageStack) {
        const initialZ = 0;
        const offset = Math.floor(imageStack.length / 2);
        const zLevels = Array.from({length: imageStack.length}, (x, i) => i - offset);
        console.log('Opening: ',imageStack);
        viewer.openFocusLevels(imageStack, initialZ, zLevels);
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

        // Similar naming convention as in layerHandlers
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
            // Ctrl scroll -> Focus change
            if (event.originalEvent.ctrlKey) {
                event.preventDefaultAction = true;
                if (event.scroll > 0) {
                    incrementFocus();
                }
                else if (event.scroll < 0) {
                    decrementFocus();
                }
            }
            // Alt scroll -> MarkerSize change
            else if (event.originalEvent.altKey) {
                event.preventDefaultAction = true;
                const slider = $('#marker_size_slider');
                const markerScale = slider.slider('getValue');
                slider.slider('setValue',markerScale+0.1*Math.sign(event.scroll),true,true);
            }
            // Shift scroll -> Rotate
            else if (event.originalEvent.shiftKey) {
                event.preventDefaultAction = true;
                _viewer.viewport.setRotation(_viewer.viewport.getRotation() + 15*Math.sign(event.scroll));
            }
/*             else if (event.originalEvent.altKey) {
                viewer.zoomPerScroll = 1.01;
            }
            else {
                viewer.zoomPerScroll = 1.3;
            } */
        };

        viewer.addViewerInputHook({hooks: [
            {
                tracker: "viewer",
                handler: "scrollHandler",
                hookHandler: scrollHook
            }
        ]});
    }

    // Called when new image is fully loaded
    function _openHandler(event, viewer, image, callback, activeViewer=true) {
        console.info("Done loading!");

        viewer.canvas.focus();
        viewer.viewport.goHome();
        _updateRotation();
        _updateZoom();
        //_updatePosition(); //called by _updateZoom

        //Load warp if existing
        const warpName=_imageWarpName(image.name);
        promiseHttpRequest("GET", warpName)
            .then(JSON.parse)
            .then(result=>_setWarp(viewer,result))
            .catch((e)=>console.log('Warp: ',e));

        _updateFocus(); //coordinateHelper.setImage must come before Mouse
        _updateBrightnessContrast();
        if (activeViewer) {
            _addMouseTracking(viewer);

            //Autoload _FL image
            const imageFL = _images.find(image => image.name === _currentImage.name+'_FL');
            if (imageFL) {
                addImage(imageFL.name);
            }
        }


        //Set better aspect ratio of navigator
        function setNavSize() {
            if (!viewer.element) return;
            
            viewer.navigator._resizeWithViewer = false;
            
            var $ = window.OpenSeadragon;
            const viewerSize = $.getElementSize( viewer.element ); //Relying on OSD's fun

            let newWidth  = viewerSize.x * viewer.navigator.sizeRatio;
            let newHeight = viewerSize.y * viewer.navigator.sizeRatio;
            
            function _getImage() {
                return _currentImage && _viewer.world.getItemAt(getFocusIndex());
            }
            const image=_getImage();
            if (image) { //Aspect ratio based on image, not viewer
                const viewAspect = newHeight/newWidth;
                const imAspect = image.getBounds().height;
                if (imAspect < viewAspect) { //Pick the smallest
                    newHeight = imAspect * newWidth;
                }
                else {
                    newWidth = newHeight / imAspect;
                }
            }
            
            viewer.navigator.element.style.width  = Math.round( newWidth ) + 'px';
            viewer.navigator.element.style.height = Math.round( newHeight ) + 'px';

            viewer.navigator.update( viewer.viewport );
        }
        setNavSize();
        viewer.addHandler("update-viewport", setNavSize);
        viewer.navigator.addHandler("resize", setNavSize);

        tmappUI.clearImageError();
        callback && callback();
        viewer.canvas.focus(); //Focus again after the callback
    }

    /**
     * callback is added to _openHandler
     */
    function _addHandlers(viewer, image, callback, activeViewer=true) {
        if (activeViewer) { 
            // Change-of-Page (z-level) handler
            viewer.addHandler("page", _updateFocus);
            viewer.addHandler("zoom", _updateZoom);
            viewer.addHandler("pan", _updatePosition);
            viewer.addHandler("rotate", _updateRotation);
            // viewer.addHandler("resize", _updateResize); //Check with MM why we needed this
        }

        // Store and add #context_menu element, s.t. we can use it in full-page/screen mode
        var context_menu_node = null;
        viewer.addHandler("pre-full-page", (event) => {context_menu_node = document.getElementById("context_menu"); console.log('stored');});
        viewer.addHandler("full-page", (event) => event.fullPage && context_menu_node && document.body.appendChild( context_menu_node ));
        
        // When leaving full-page mode, update counts
        viewer.addHandler("full-page", (event) => !event.fullPage && annotationHandler && annotationHandler.updateAnnotationCounts());

        // When we're done loading
        viewer.addHandler("open", event => _openHandler(event,viewer,image,callback,activeViewer));

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
     * Create a new OSD viewer instance
     * Creating the DOM node for the viewer.
     * Getting a full stack of image names based on the original imageName, 
     * loading the images from the server.
     */
    let _nextViewerId=0; // Running index of OSD-viewers
    function _newViewer(imageName, callback=null) {
        const image = _images.find(image => image.name === imageName);
        if (!image) {
            tmappUI.displayImageError("badimage");
            throw new Error(`Failed to open image ${imageName}.`);
        }

        console.log(`Opening image ${image.name} -> Viewer #${_nextViewerId}`);
        const idString=`viewer_${_nextViewerId}`;

        //Create html element for viewer
        document.querySelector('#viewer_container').insertAdjacentHTML(
            'afterbegin',
            `<div id="${idString}" class="ISS_viewer flex-grow-1 h-100 w-100" style="transition: 0s opacity;position: absolute;"></div>` //Don't know why css doesn't catch
        )

        //Create OSD viewer
        const options={..._optionsOSD};
        Object.assign(options,{
            id: idString,
            // showNavigator: _viewer==null, //For the moment we don't support multiple navigators
            // showNavigationControl: _viewer==null //For the moment we don't support multiple controls
        });
        console.log('ID: ',options.id);
        const newViewer = OpenSeadragon(options);
        _nextViewerId++;

        //open the DZI xml file pointing to the tiles
        const imageStack = _expandImageName(image);
        _openImages(newViewer,imageStack);
        newViewer.name = imageName;

        return newViewer;
    }

    /**
     * Create all the (non-image) overlays (once)
     * Connected to _viewer (which must be set)
     */
    function _initOverlays() {
        //Create a wrapper in which we place all overlays, s.t. we can switch with zIndex but still get Navigator and On-screen menu
        const overlayDiv = document.createElement('div');
        overlayDiv.id = 'overlay_div';
        overlayDiv.style.position = 'absolute';
        overlayDiv.style.left = 0;
        overlayDiv.style.top = 0;
        overlayDiv.style.width = '100%';
        overlayDiv.style.height = '100%';
        overlayDiv.style.zIndex = 0; //We use zIndex inside
        _viewer.canvas.appendChild(overlayDiv);

        //Since scale < image.size, it is not pixel-perfect
        const attentionLayer = new AttentionLayer("attention", _viewer.pixiOverlay({container:overlayDiv}));
        layerHandler.addLayer(attentionLayer);
    
        const svgOverlay = _viewer.svgOverlay(overlayDiv); //Shared for regions and collab (for the moment)
        const collabLayer = new CollabLayer("collab",svgOverlay);
        layerHandler.addLayer(collabLayer);
        
        const regionLayer = new RegionLayer("region",svgOverlay);
        layerHandler.addLayer(regionLayer);
  
        const markerLayer = new MarkerLayer("marker", _viewer.pixiOverlay({container:overlayDiv}));
        layerHandler.addLayer(markerLayer);



        //PIXI.Ticker.shared.add(() => fps.frame());

        // var ticker = PIXI.Ticker.shared;
        // ticker.autoStart = false;
        // ticker.stop();

        // renderer.plugins.interaction.destroy();
        // renderer.plugins.interaction = null;
    }

    /**
     * Initialize an instance of OpenSeadragon. 
     * Creating the DOM node for the viewer.
     * Getting a full stack of image names based on the original imageName, 
     * loading the images from the server
     * 
     * If no _viewer/_current image, then also initializing the overlay.
     * 
     * @param {string} imageName Name of the image to open.
     * @param {Function} callback Function to call once the images have
     * been successfully loaded.
     */
    function _newOSD(imageName, callback=null) {
        const image = _images.find(image => image.name === imageName);
        if (!image) {
            tmappUI.displayImageError("badimage");
            throw new Error(`Failed to open image ${imageName}.`);
        }
        
        const newViewer = _newViewer(imageName);
        
        //Put last
        _viewers.push(newViewer);
        _imageStates.push({..._imageState}); //Add new default state
        htmlHelper.addFocusSlider(newViewer);

        //First viewer is main
        const withOverlay = _viewer==null;

        //don't add more handlers than needed
        _addHandlers(newViewer, image, callback, withOverlay);

        if (withOverlay) {
            if (_viewers.length > 1) {
                console.warn('First is not first!?');
            }

            _viewer = newViewer; 
            _currentImage = image;

            _currState.z = _viewer.getFocusLevel(); 
            _viewer.scalebar(); 

            _imageStates[0].z = _viewers[0].getFocusLevel(); 
            _updateStateSliders();
                
            _initOverlays();
        }
        _updateViewers();

        _viewers.forEach((v,i) => {console.log(`Viewers[${i}]: ${v.name}`)});
    }

    function _clearAllViewers() {
        while (_viewers.length) {
            const v = _viewers.pop();
            console.log('Clear viewer: ',v.id);
            $("#"+v.id).empty(); //remove descendants of DOM node (alt. while (foo.firstChild) foo.removeChild(foo.firstChild); )
            v.element.remove(); //remove DOM node
            v.destroy();
        }
        _imageStates=[];
        _viewer=null;
        _currentImage=null;
    }
    function _clearCurrentImage() {
        if (!_viewer) {
            return;
        }
        if (_mouseHandler) { //First stop any mouse input
            _currentMouseUpdateFun=null;
            _mouseHandler.setTracking(false);
            _mouseHandler.destroy();
        }
        annotationHandler.clear(false);
        metadataHandler.clear();
        coordinateHelper.clearImage();
        layerHandler.destroy();
        _clearAllViewers(); //currently not supporting partial clear
        // $("#navigator_div").empty(); //not cleaned up by OSD destroy it seems
        $("#toolbar_sliderdiv").empty(); //Our focus sliders
        _disabledControls = false;
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
        console.log('Init CytoBrowser');

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

                    const filteredImages = _filterImages(images); //Filter out _FL image
                    
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
                        collabPicker.open(imageName, true, true, () => {
                            if (initialState) {
                                moveTo(initialState);
                            }
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
            callback && callback(); //This violates specification above
        }
        else {
            _clearCurrentImage(); 
            _newOSD(imageName, callback);
            tmappUI.setImageName(_currentImage.name);
            _updateURLParams();
        }
    }

    /**
     * Similar to openImage, but adding instead of replacing
     * @param {string} imageName The name of the image being opened.
     */
    function addImage(imageName, callback) {
        _newOSD(imageName,callback);
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
            if (_viewer.transform?.scale && !_viewer.transform?.disabled) {
                zoom *= _viewer.transform.scale;
            }
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
            if (_viewer.transform?.position && !_viewer.transform?.disabled) {
                x += _viewer.transform.position.x;
                y += _viewer.transform.position.y;
            }
            const boundX = capValue(x, minX, maxX);
            const boundY = capValue(y, minY, maxY);
            const point = new OpenSeadragon.Point(boundX, boundY);
            _viewer.viewport.panTo(point, true);
        }
        if (rotation !== undefined) {
            if (_viewer.transform?.rotation && !_viewer.transform?.disabled) {
                rotation += _viewer.transform.rotation;
            }
            _viewer.viewport.setRotation(rotation);
        }
        if (z !== undefined) {
            _setFocusLevel(z);
        }
    }

    // Zoom level which is suitable for annotation diameter
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
     * Get the available z levels for the _viewer.
     * @returns {Array} An array of the available z levels.
     */
    function getZLevels() {
        return _viewer? _viewer.getFocusLevels() : [];
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
        _viewer.controls.forEach(e => e.element.style.visibility="visible"); //In MM we use Add/Remove
        _disabledControls = false;
    }

    /**
     * Disable all control over the viewport state.
     */
    function disableControls() {
        if (_disabledControls) {
            return;
        }
        _viewer.setMouseNavEnabled(false);

        // API docs suggest setControlsEnabled(false), doesn't seem to work
        _viewer.controls.forEach(e => e.element.style.visibility="hidden");
        _disabledControls=true;
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

    function _updateViewers() {
        _viewers.forEach((v,i) => {
            v.setControlsEnabled(i==0); //Disable OSD controls for non-top
            v.element.style.zIndex = 100-i; //Set z-index
            v.element.style.pointerEvents = (i==0)?"auto":"none"; //Ignore mouse for non-top viewers
        });
    }
    function _viewerSwap(i,j) {
        _viewers[i].element.style.zIndex = 100-j;
        _viewers[j].element.style.zIndex = 100-i;
        [ _viewers[j], _viewers[i] ] = [ _viewers[i], _viewers[j] ];
        [ _imageStates[j], _imageStates[i] ] = [ _imageStates[i], _imageStates[j] ];
        _updateViewers();
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
            _updateViewers();
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
            _updateViewers();
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

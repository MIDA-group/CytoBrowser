/**
 * Functions related to interaction with the OpenSeadragon viewer, including
 * initialization, image information, updating the current URL state, etc.
 * @namespace tmapp
 */
const tmapp = (function() {
    "use strict";

    const _imageDir = "data/";
    const _optionsOSD = {
        id: "ISS_viewer", //cybr_viewer
        prefixUrl: "js/openseadragon/images/", //Location of button graphics
        navigatorSizeRatio: 1,
        wrapHorizontal: false,
        showNavigator: true,
        navigatorPosition: "BOTTOM_LEFT",
        navigatorSizeRatio: 0.25,
        animationTime: 0.0,
        blendTime: 0,
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

    let _currentImage,
        _images,
        _collab,
        _viewer,
        _currState = {
            x: 0.5,
            y: 0.5,
            z: 0,
            rotation: 0,
            zoom: 1,
            brightness: 0,
            contrast: 0
        },
        _cursorStatus = {
            x: 0.5,
            y: 0.5,
            held: false,
            inside: false
        },
        _lastMouseMoveEvent=null,
        _disabledControls,
        _availableZLevels,
        _mouseHandler;

    function _getFocusIndex() {
        return _currState.z + Math.floor(_currentImage.zLevels.length / 2);
    }

    function _setFocusLevel(z) {
        const count = _viewer.world.getItemCount();
        const ofs = Math.floor(_currentImage.zLevels.length / 2);
        z = Math.min(Math.max(z,-ofs),count-1-ofs);
        _viewer.setFocusLevel(z);
        _currState.z = z;
        _updateFocus();
    }

    function _updateFocus() {
        if (!_viewer) {
            throw new Error("Tried to update focus of nonexistent viewer.");
        }
        const index = _getFocusIndex();
        tmappUI.setImageZLevel(_currentImage.zLevels[index]);
        coordinateHelper.setImage(_viewer.world.getItemAt(index));
        _updateCollabPosition();
        _updateURLParams();
    }

    function setBrightness(b) {
        _currState.brightness = b;
        _updateBrightnessContrast();
    }

    function setContrast(c) {
        _currState.contrast = c;
        _updateBrightnessContrast();
    }

    /**
     * Apply _currState brightness/contrast to current viewer
     */
    function _updateBrightnessContrast() {
        //const ctx=_viewer.drawer.context;
        //Since I'm not 100% sure that Safari supports the above
        // https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/filter
        //we use the css-style property instead
        const ctx=document.getElementById("ISS_viewer").querySelector('.openseadragon-canvas').querySelector('canvas').style;
        if (_currState.contrast==0 && _currState.brightness==0) {
            ctx.filter = 'none';
        }
        else {
            ctx.filter = `brightness(${Math.pow(2,2*_currState.brightness)}) contrast(${Math.pow(4,_currState.contrast)})`;
        }
        _viewer.world.draw();
    }

    function _updateZoom() {
        if (!_viewer) {
            throw new Error("Tried to update zoom of nonexistent viewer.");
        }
        const zoom = _viewer.viewport.getZoom();
        const maxZoom = _viewer.viewport.getMaxZoom();
        const size = _viewer.viewport.getContainerSize();
        overlayHandler.setOverlayScale(zoom, maxZoom, size.x, size.y);
        tmappUI.setImageZoom(Math.round(zoom*10)/10);
        _currState.zoom = zoom;

        // Zooming often changes the position too, based on cursor position
        _updatePosition();
    }

    function _updatePosition() {
        if (!_viewer) {
            throw new Error("Tried to update position of nonexistent viewer.");
        }
        const position = _viewer.viewport.getCenter();
        _currState.x = position.x;
        _currState.y = position.y;
        _updateCollabPosition();
        _updateURLParams();
    }

    function _updateRotation() {
        if (!_viewer) {
            throw new Error("Tried to update rotation of nonexistent viewer.");
        }
        const rotation = _viewer.viewport.getRotation();
        overlayHandler.setOverlayRotation(rotation);
        tmappUI.setImageRotation(rotation);
        _currState.rotation = rotation;
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

    function _updateCollabPosition() {
        collabClient.updatePosition(_currState);
    }

    function _updateCollabCursor() {
        collabClient.updateCursor(_cursorStatus);
    }

    function _expandImageName() {
        // Get the full image names based on the data from the server
        const imageName = _currentImage.name;
        const zLevels = _currentImage.zLevels;
        const imageStack = zLevels.map(zLevel => {
            return `${_imageDir}${imageName}_z${zLevel}.dzi`;
        });
        return imageStack;
    }

    function _openImages(imageStack) {
        const initialZ = 0;
        const offset = Math.floor(imageStack.length / 2);
        const zLevels = Array.from({length: imageStack.length}, (x, i) => i - offset);
        _availableZLevels = zLevels;
        console.info(`Opening: ${imageStack}`);
        _viewer.openFocusLevels(imageStack, initialZ, zLevels);
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

        // Live updates of mouse position in collaboration
        // Store event to re-dispatch on viewport-change
        function moveHandler(event) {
            _lastMouseMoveEvent=new MouseEvent(event.originalEvent.type, event.originalEvent);
            if (!_cursorStatus.held) {
                const pos = coordinateHelper.webToViewport(event.position);
                setCursorStatus({x: pos.x, y: pos.y});
            }
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

        // Add hook to scroll without zooming, didn't seem possible without
        function scrollHook(event){
            if (event.originalEvent.ctrlKey) {
                event.preventDefaultAction = true;
                if (event.scroll > 0) {
                    incrementFocus();
                }
                else if (event.scroll < 0) {
                    decrementFocus();
                }
            }
            if (event.originalEvent.shiftKey) {
                event.preventDefaultAction = true;
                const rotation = _currState.rotation;
                if (event.scroll > 0) {
                    _viewer.viewport.setRotation(rotation + 15);
                }
                else if (event.scroll < 0) {
                    _viewer.viewport.setRotation(rotation - 15);
                }
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

    function _addHandlers (viewer, callback) {
        // Change-of-Page (z-level) handler
        viewer.addHandler("page", _updateFocus);
        viewer.addHandler("zoom", _updateZoom);
        viewer.addHandler("pan", _updatePosition);
        viewer.addHandler("rotate", _updateRotation);

        // When we're done loading
        viewer.addHandler("open", function (event) {
            console.info("Done loading!");
            _addMouseTracking(viewer);
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

        viewer.addHandler('viewport-change', (event) => {
            if (_lastMouseMoveEvent) {
                const elem = tmapp.mouseHandler().element;
                elem.dispatchEvent(_lastMouseMoveEvent); // Mouse moves in the image, trigger updates
            }
        });
    }

    /**
     * Initialize an instance of OpenSeadragon. This involves getting
     * a full stack of image names based on the original name, loading the
     * images from the server, and initializing the overlay.
     * @param {Function} callback Function to call once the images have
     * been successfully loaded.
     */
    function _initOSD(callback) {
        //init OSD viewer
        _viewer = OpenSeadragon(_optionsOSD);
        _viewer.scalebar();
        _addHandlers(_viewer, callback);

        //open the DZI xml file pointing to the tiles
        const imageName = _currentImage.name;
        const imageStack = _expandImageName(imageName);
        _openImages(imageStack);

        const overlay = _viewer.svgOverlay();
        const pixiOverlay = _viewer.pixiOverlay();
        overlayHandler.init(overlay,pixiOverlay);

        //PIXI.Ticker.shared.add(() => fps.frame());

        // var ticker = PIXI.Ticker.shared;
        // ticker.autoStart = false;
        // ticker.stop();

        // renderer.plugins.interaction.destroy();
        // renderer.plugins.interaction = null;
    }

    function _clearCurrentImage() {
        if (!_viewer) {
            return;
        }
        annotationHandler.clear(false);
        metadataHandler.clear();
        _viewer && _viewer.destroy();
        $("#ISS_viewer").empty();
        coordinateHelper.clearImage();
        _disabledControls = null;
        _availableZLevels = null;
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
                    tmappUI.updateImageBrowser(images);
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
            const image = _images.find(image => image.name === imageName);
            if (!image) {
                tmappUI.displayImageError("badimage");
                throw new Error(`Failed to open image ${imageName}.`);
            }
            _clearCurrentImage();
            _currentImage = image;
            tmappUI.setImageName(_currentImage.name);
            _updateURLParams();
            _initOSD(callback);
        }
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
            _setFocusLevel(_currState.z + 1);
        }
    }

    /**
     * Decrement the Z level by 1, if possible.
     */
    function decrementFocus() {
        if (!_disabledControls) {
            _setFocusLevel(_currState.z - 1);
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
     * Change brightness level by delta.
     */
    function changeBrightness(delta) {
        setBrightness(_currState.brightness+delta);
    }

    /**
     * Change contrast level by delta.
     */
    function changeContrast(delta) {
        setContrast(_currState.contrast+delta);
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

        setBrightness,
        setContrast,
        changeBrightness,
        changeContrast,

        getImageName,
        updateCollabStatus,
        setCursorStatus,
        enableControls,
        disableControls,

        keyHandler,
        keyDownHandler,
        mouseHandler,

        updateScalebar
    };
})();

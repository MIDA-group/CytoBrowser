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
        minZoomImageRatio: 1,
        maxZoomPixelRatio: 4,
        gestureSettingsMouse: {clickToZoom: false},
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
        _imageStack = [],
        _currState = {
            x: 0.5,
            y: 0.5,
            z: 0,
            zoom: 1
        },
        _currMclass = "",
        _cursorStatus = {
            x: 0.5,
            y: 0.5,
            held: false,
            inside: false
        };


    function _getFocusIndex() {
        return _currState.z + Math.floor(_currentImage.zLevels.length / 2);
    }

    function _setFocusLevel(z) {
        const count = _viewer.world.getItemCount();
        const max = Math.floor(count / 2);
        const min = -max;
        z = Math.min(Math.max(z,min),max);
        for (let i = min; i <= max; i++) {
            let idx = i + Math.floor(_currentImage.zLevels.length / 2);
            _viewer.world.getItemAt(idx).setOpacity(z === i);
        }
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

    function _updateZoom() {
        if (!_viewer) {
            throw new Error("Tried to update zoom of nonexistent viewer.");
        }
        const zoom = _viewer.viewport.getZoom();
        const size = _viewer.viewport.getContainerSize();
        overlayHandler.setOverlayScale(zoom, size.x, size.y);
        tmappUI.setImageZoom(Math.round(zoom*10)/10);
        _currState.zoom = zoom;
        _updateCollabPosition();
        _updateURLParams();
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

    function _updateURLParams() {
        const url = new URL(window.location.href);
        const roundTo = (x, n) => Math.round(x * Math.pow(10, n)) / Math.pow(10, n);
        const params = url.searchParams;
        if (_currentImage) {
            params.set("image", _currentImage.name);
            params.set("zoom", roundTo(_currState.zoom, 2));
            params.set("x", roundTo(_currState.x, 5));
            params.set("y", roundTo(_currState.y, 5));
            params.set("z", _currState.z);
        }
        _collab ? params.set("collab", _collab) : params.delete("collab");
        tmappUI.setURL("?" + params.toString()); // TODO: weird args
    }

    function _setCursorStatus(status) {
        Object.assign(_cursorStatus, status);
        _updateCollabCursor();
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
        _imageStack = [];
        _currentImage.zLevels.forEach(zLevel => {
            _imageStack.push(`${_imageDir}${imageName}_z${zLevel}.dzi`);
        });
    }

    function _loadImages(z =  -1) {
        if (z < 0) {
            z = Math.floor(_imageStack.length / 2);
        }
        _currState.x = z;

        console.info(`Opening: ${_imageStack}`);
        _imageStack.forEach((image, i) => {
            _viewer.addTiledImage({
                tileSource: image,
                opacity: i === _currState.z,
                index: i++,
                success: () => {
                    if (_viewer.world.getItemCount() === _imageStack.length) {
                        _viewer.raiseEvent("open");
                    }
                },
                error: () => {
                    _viewer.raiseEvent("open-failed");
                },
            });
        });
    }

    function _addMouseTracking(viewer) {
        // Handle quick and slow clicks
        function clickHandler(event) {
            if(event.quick){
                if (tmappUI.inFocus() && !event.ctrlKey) {
                    const marker = {
                        x: event.position.x,
                        y: event.position.y,
                        z: _currState.z,
                        mclass: _currMclass
                    };
                    markerHandler.addMarker(marker);
                }
            }
        };

        // Live updates of mouse position in collaboration
        function moveHandler(event) {
            const pos = coordinateHelper.webToViewport(event.position);
            _setCursorStatus({x: pos.x, y: pos.y});
        }

        // Live updates of whether or not the mouse is held down
        function heldHandler(held) {
            return function(event) {
                const pos = coordinateHelper.webToViewport(event.position);
                _setCursorStatus({held: held});
            };
        }

        // Live update of whether or not the mouse is in the viewport
        function insideHandler(inside) {
            return function(event) {
                const pos = coordinateHelper.webToViewport(event.position);
                _setCursorStatus({inside: inside});
            };
        }

        //OSD handlers have to be registered using MouseTracker OSD objects
        new OpenSeadragon.MouseTracker({
            element: viewer.canvas,
            clickHandler: clickHandler,
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

        // When we're done loading
        viewer.addHandler("open", function (event) {
            console.info("Done loading!");
            _addMouseTracking(viewer);
            viewer.canvas.focus();
            viewer.viewport.goHome();
            _updateZoom();
            _updateFocus();
            _updatePosition();
            callback && callback();
            tmappUI.clearImageError();
            tmappUI.enableCollabCreation();
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
    }

    function _initOSD(callback) {
        _expandImageName(_currentImage.name);

        //init OSD viewer
        _viewer = OpenSeadragon(_optionsOSD);
        _addHandlers(_viewer, callback);

        //open the DZI xml file pointing to the tiles
        _loadImages();

        //Create svgOverlay(); so that anything like D3, or any canvas library can act upon. https://d3js.org/
        const overlay =  _viewer.svgOverlay();
        overlayHandler.init(overlay);
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
        imageReq.open("GET", window.location.origin + "/api/images", true);
        imageReq.send(null);

        imageReq.onreadystatechange = function() {
            if (imageReq.readyState !== 4) {
                return;
            }
            switch (imageReq.status) {
                case 200:
                    // Add the images to the image browser
                    const images = JSON.parse(imageReq.responseText).images;
                    images.forEach(image => tmappUI.addImage(image));
                    _images = images;

                    // Go to the initial image and/or join the collab
                    if (imageName) {
                        const image = images.find(image => image.name === imageName);
                        if (image) {
                            openImage(imageName, () => {
                                if (collab) {
                                    collabClient.connect(collab);
                                }
                                if (initialState) {
                                    moveTo(initialState);
                                }
                            });
                        }
                        else {
                            tmappUI.displayImageError("badimage");
                        }
                    }
                    else {
                        tmappUI.displayImageError("noimage");
                    }
                    if (collab && !imageName) {
                        collabClient.connect(collab);
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
     * Open a specified image in the viewport. If markers have been
     * placed, the user is first prompted to see if they actually want
     * to open the image or if they want to cancel.
     * @param {string} imageName The name of the image being opened.
     * @param {Function} callback Function to call if and only if the
     * image is successfully opened.
     * @param {Function} nochange Function to call if the user is
     * prompted on whether or not they want to change images and they
     * decide not to change.
     */
    function openImage(imageName, callback, nochange) {
        if (!markerHandler.empty() && !confirm(`You are about to open ` +
            `the image "${imageName}". Do you want to ` +
            `open this image? Any markers placed on the ` +
            `current image will be lost unless you save ` +
            `them first.`)) {
            nochange && nochange();
            return;
        }

        const image = _images.find(image => image.name === imageName);
        if (!image) {
            tmappUI.displayImageError("badimage", 5000);
            throw new Error("Tried to change to an unknown image.");
        }
        markerHandler.clearMarkers(false);
        $("#ISS_viewer").empty();
        coordinateHelper.clearImage();
        _currentImage = image;
        _updateURLParams();
        _initOSD(callback);
    }

    /**
     * Move to a specified state in the viewport. If the state is only
     * partially defined, the rest of the viewport state will remain
     * the same as it was.
     * @param {Object} state The viewport state to move to.
     * @param {number} state.x The x position of the viewport.
     * @param {number} state.y The y position of the viewport.
     * @param {number} state.z The z level in the viewport.
     * @param {number} state.zoom The zoom in the viewport.
     */
    function moveTo({x, y, z, zoom}) {
        if (!_viewer) {
            throw new Error("Tried to move viewport without a viewer.");
        }
        if (zoom) {
            _viewer.viewport.zoomTo(zoom, true);
        }
        if (x && y) {
            _viewer.viewport.panTo(new OpenSeadragon.Point(x, y), true);
        }
        if (z) {
            _setFocusLevel(z);
        }
    }

    /**
     * Move the viewport to look at a specific marker.
     * @param {number} id The id of the marker being moved to.
     */
    function moveToMarker(id) {
        const marker = markerHandler.getMarkerById(id);
        if (marker === undefined) {
            throw new Error("Tried to move to an unused marker id.");
        }
        const viewportCoords = coordinateHelper.imageToViewport(marker);
        moveTo({
            zoom: 25,
            x: viewportCoords.x,
            y: viewportCoords.y,
            z: marker.z
        });
    }

    /**
     * Set the current marker class being assigned.
     * @param {string} mclass The currently active marker class.
     */
    function setMclass(mclass) {
        if (bethesdaClassUtils.getIDFromName(mclass) >= 0) {
            _currMclass = mclass;
        }
        else {
            throw new Error("Tried to set the active marker class to something not defined.");
        }
    }

    /**
     * Set the current collaboration id, update the URL parameters and
     * set the appropriate URL parameters.
     @param {string} id The collaboration id being set.
     */
    function setCollab(id) {
        _collab = id;
        tmappUI.setCollabID(id);
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
        _setFocusLevel(_currState.z + 1);
    }

    /**
     * Decrement the Z level by 1, if possible.
     */
    function decrementFocus() {
        _setFocusLevel(_currState.z - 1);
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

    return {
        init: init,
        openImage: openImage,
        moveTo: moveTo,
        moveToMarker: moveToMarker,
        setMclass: setMclass,
        setCollab: setCollab,
        clearCollab: clearCollab,
        incrementFocus: incrementFocus,
        decrementFocus: decrementFocus,
        getImageName: getImageName,
        updateCollabStatus: updateCollabStatus
    };
})();

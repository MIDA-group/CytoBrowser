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
        showNavigationControl: true, //FIX: After Full screen, interface stops working
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
        _currX = 0.5,
        _currY = 0.5,
        _currZ = 0,
        _currZoom = 1,
        _currMclass = "",
        _cursorStatus = {
            x: 0.5,
            y: 0.5,
            held: false,
            inside: false
        };


    function _getFocusIndex() {
        return _currZ + Math.floor(_currentImage.zLevels.length / 2);
    }

    function _setFocusLevel(z) {
        const count = _viewer.world.getItemCount();
        const max = Math.floor(count / 2);
        const min = -max;
        z = Math.min(Math.max(z,min),max);
        for (let i = min; i <= max; i++) {
            let idx = i + Math.floor(_currentImage.zLevels.length / 2);
            _viewer.world.getItemAt(idx).setOpacity(z == i);
        }
        _currZ = z;
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
        _currZoom = zoom;
        _updateCollabPosition();
        _updateURLParams();
    }

    function _updatePosition() {
        if (!_viewer) {
            throw new Error("Tried to update position of nonexistent viewer.");
        }
        const position = _viewer.viewport.getCenter();
        _currX = position.x; // TODO: Maybe put all curr in a currState object?
        _currY = position.y;
        _updateCollabPosition();
        _updateURLParams();
    }

    function _updateURLParams() {
        const url = new URL(window.location.href);
        const roundTo = (x, n) => Math.round(x * Math.pow(10, n)) / Math.pow(10, n);
        const params = url.searchParams;
        params.set("image", _currentImage.name);
        params.set("zoom", roundTo(_currZoom, 2));
        params.set("x", roundTo(_currX, 5));
        params.set("y", roundTo(_currY, 5));
        params.set("z", _currZ);
        _collab ? params.set("collab", _collab) : params.delete("collab");
        tmappUI.setURL("?" + params.toString()); // TODO: weird args
    }

    function _setCursorStatus(status) {
        Object.assign(_cursorStatus, status);
        _updateCollabCursor();
    }

    function _updateCollabPosition() {
        collabClient.updatePosition({
            x: _currX,
            y: _currY,
            z: _currZ,
            zoom: _currZoom
        });
    }

    function _updateCollabCursor() {
        collabClient.updateCursor(_cursorStatus);
    }

    function _expandImageName(imageName) {
        // Get the full image names based on the data from the server
        _imageStack = [];
        _currentImage.zLevels.forEach((zLevel) => {
            _imageStack.push(`${_imageDir}${imageName}_z${zLevel}.dzi`);
        });
    }

    function _loadImages(z =  -1) {
        if (z < 0) {
            z = Math.floor(_imageStack.length / 2);
        }
        _currZ = z;

        console.info(`Opening: ${_imageStack}`);
        _imageStack.forEach((image, i) => {
            _viewer.addTiledImage({
                tileSource: image,
                opacity: i === _currZ,
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

    function _addHandlers (viewer, callback) {
        // Change-of-Page (z-level) handler
        viewer.addHandler("page", _updateFocus);
        viewer.addHandler("zoom", _updateZoom);
        viewer.addHandler("pan", _updatePosition);

        // When we're done loading
        viewer.addHandler("open", function (event) {
            console.info("Done loading!");
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
        // tmapp.ISS_singleTMCPS=d3.select(overlay.node()).append('g').attr('class', "ISS singleTMCPS"); // TODO: handle elsewhere
        overlayHandler.init(overlay);

        //This is the OSD click handler, when the event is quick it triggers the creation of a marker
        //Called when we are far from any existing points; if we are close to elem, then DOM code in overlayUtils is called instead
        const clickHandler = function(event) {
            if(event.quick){
                // TODO: Fix focus
                /*
                if (tmapp.lost_focus) { //We get document focus back before getting the event
                    console.log("Lost document focus, ignoring click and just setting (element) focus"); //Since it's irritating to get TMCP by asking for focus
                    tmapp.fixed_viewer.canvas.focus();
                    tmapp.checkFocus();
                }
                */
                if (!event.ctrlKey) {
                    console.log("Adding point");
                    const point = {
                        x: event.position.x,
                        y: event.position.y,
                        z: _currZ,
                        mclass: _currMclass
                    };
                    markerPoints.addPoint(point);
                }
            }
            else {
                //if it is not quick then it is dragged
                console.log("drag thing");
            }
        };

        const scrollHandler = function(event){
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

        // Live updates of mouse position in collaboration
        const moveHandler = function(event) {
            const pos = coordinateHelper.webToViewport(event.position);
            _setCursorStatus({x: pos.x, y: pos.y});
        }

        // Live updates of whether or not the mouse is held down
        const heldHandler = function(held) {
            return function(event) {
                const pos = coordinateHelper.webToViewport(event.position);
                _setCursorStatus({
                    held: held,
                    x: pos.x,
                    y: pos.y
                });
            };
        }

        // Live update of whether or not the mouse is in the viewport
        const insideHandler = function(inside) {
            return function(event) {
                const pos = coordinateHelper.webToViewport(event.position);
                _setCursorStatus({
                    inside: inside,
                    x: pos.x,
                    y: pos.y
                });
            };
        }

        //OSD handlers have to be registered using MouseTracker OSD objects
        const ISS_mouse_tracker = new OpenSeadragon.MouseTracker({
            element: _viewer.canvas,
            clickHandler: clickHandler,
            scrollHandler: scrollHandler,
            moveHandler: moveHandler,
            enterHandler: insideHandler(true),
            exitHandler: insideHandler(false),
            pressHandler: heldHandler(true),
            releaseHandler: heldHandler(false)
        }).setTracking(true);

        // TODO: What does this do?
        // tmapp.viewer.canvas.addEventListener('mouseover', function() { tmapp.checkFocus(); });
    }

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
                    images.forEach((image) => tmappUI.addImage(image));
                    _images = images;

                    // Go to the initial image and/or join the collab
                    if (imageName) {
                        const image = images.find((image) => image.name === imageName);
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
                    if (collab) {
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

    function openImage(imageName, callback, nochange) {
        if (!markerPoints.empty() && !confirm(`You are about to open ` +
            `the image "${imageName}". Do you want to ` +
            `open this image? Any markers placed on the ` +
            `current image will be lost unless you save ` +
            `them first.`)) {
            nochange && nochange();
            return;
        }

        const image = _images.find((image) => image.name === imageName);
        if (!image) {
            tmappUI.displayImageError("badimage", 5000);
            throw new Error("Tried to change to an unknown image.");
        }
        markerPoints.clearPoints(false);
        $("#ISS_viewer").empty();
        coordinateHelper.clearImage();
        _currentImage = image;
        _updateURLParams();
        _initOSD(callback);
    }

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

    function moveToPoint(id) {
        const point = markerPoints.getPointById(id);
        if (point === undefined) {
            throw new Error("Tried to move to an unused point id.");
        }
        const viewportCoords = coordinateHelper.imageToViewport(point);
        moveTo({
            zoom: 25,
            x: viewportCoords.x,
            y: viewportCoords.y,
            z: point.z
        });
    }

    function setMClass(mClass) {
        if (bethesdaClassUtils.getIDFromName(mClass) >= 0) {
            _currMclass = mClass; // TODO: mClass or mclass?
        }
        else {
            throw new Error("Tried to set the active marker class to something not defined.");
        }
    }

    function setCollab(id) {
        if (id) {
            _collab = id;
            tmappUI.setCollabID(id);
        }
        else {
            _collab = null;
            tmappUI.clearCollabID();
        }
        _updateURLParams();
    }

    function incrementFocus() {
        _setFocusLevel(_currZ + 1);
    }

    function decrementFocus() {
        _setFocusLevel(_currZ - 1);
    }

    function addMarkerStorageData(data, clear = false) {
        switch (data.version) {
            case "1.0":
                // Change image if data is for another image
                if (data.image !== _currentImage.name) {
                    openImage(data.image, function() {
                        collabClient.send({
                            type: "imageSwap", // TODO: Should maybe leave message formatting to collabClient
                            image: data.image
                        });
                        data.points.forEach((point) => {
                            markerPoints.addPoint(point, "image");
                        });
                    });
                    break;
                }
                clear && markerPoints.clearPoints();
                data.points.forEach((point) => {
                    markerPoints.addPoint(point, "image");
                })
                break;
            default:
                throw new Error(`Data format version ${points.version} not implemented.`);
        }
    }

    function getMarkerStorageData() {
        const data = {
            version: "1.0", // Version of the formatting
            image: _currentImage.name,
            points: []
        };
        markerPoints.forEachPoint((point) => {
            data.points.push(point)
        });
        return data;
    }

    return {
        init: init,
        openImage: openImage,
        moveTo: moveTo,
        moveToPoint: moveToPoint,
        setMClass: setMClass,
        setCollab: setCollab,
        incrementFocus: incrementFocus,
        decrementFocus: decrementFocus,
        addMarkerStorageData: addMarkerStorageData,
        getMarkerStorageData: getMarkerStorageData
    };
})();

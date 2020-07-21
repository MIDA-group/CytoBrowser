const tmapp2 = (function() {
    "use strict";

    let _currentImage,
        _collab,
        _imageStack,
        _viewer;

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

    function _updateURLParams() {
        const url = new URL(window.location.href);
        const roundTo = (x, n) => Math.round(x * Math.pow(10, n)) / Math.pow(10, n);
        const params = url.searchParams;
        params.set("image", tmapp.image_name);
        params.set("zoom", roundTo(this.curr_zoom, 2));
        params.set("x", roundTo(this.curr_x, 5));
        params.set("y", roundTo(this.curr_y, 5));
        params.set("z", this.curr_z);
        _collab ? params.set("collab", _collab) : params.delete("collab");
        tmappUI.setURL("?" + params.toString());
    }

    function _expandImageName(imageName) {
        // Get the full image names based on the data from the server
        _imageStack = [];
        const imageInfo = _images.find((image) => image.name === _currentImage);
        imageInfo.zLevels.sort((a, b) => +a - +b).map((zLevel) => {
            _imageStack.push(`${imageName}_z${zLevel}.dzi`);
        });
    }

    function _loadImages(z =  -1) {
        if (z < 0) {
            z = Math.floor(this.fixed_file.length / 2);
        }
        curr_z = z;

        console.info(`Opening: ${_imageStack}`);
        _imageStack.forEach((image, i) => {
            _viewer.addTiledImage({
                tileSource: image,
                opacity: i === curr_z,
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
        //Change-of-Page (z-level) handler
        viewer.addHandler("page", function (data) {
            tmapp.setFocusName();
        });

        viewer.addHandler("zoom", function (data) {
            tmapp.setZoomName();
        });

        viewer.addHandler("pan", function (data) {
            tmapp.setPosition();
        });

        //When we're done loading
        viewer.addHandler("open", function ( event ) {
            console.log("Done loading!");
            viewer.canvas.focus();
            viewer.viewport.goHome();
            tmapp.setZoomName();
            tmapp.setFocusName();
            callback && callback();
            tmappUI.clearImageError();
            tmappUI.enableCollabCreation();
        });

        //Error message if we fail to load
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
        _expandImageName(imageName);

        //init OSD viewer
        _viewer = OpenSeadragon(_optionsOSD);
        _addHandlers(_viewer, callback);

        //open the DZI xml file pointing to the tiles
        loadImages();

        //Create svgOverlay(); so that anything like D3, or any canvas library can act upon. https://d3js.org/
        const overlay =  viewer.svgOverlay();
        tmapp.ISS_singleTMCPS=d3.select(tmapp.svgov.node()).append('g').attr('class', "ISS singleTMCPS"); // TODO: handle elsewhere
        overlayHandler.init(overlay);

        //This is the OSD click handler, when the event is quick it triggers the creation of a marker
        //Called when we are far from any existing points; if we are close to elem, then DOM code in overlayUtils is called instead
        const clickHandler = function(event) {
            if(event.quick){
                if (tmapp.lost_focus) { //We get document focus back before getting the event
                    console.log("Lost document focus, ignoring click and just setting (element) focus"); //Since it's irritating to get TMCP by asking for focus
                    tmapp.fixed_viewer.canvas.focus();
                    tmapp.checkFocus();
                }
                else if (!event.ctrlKey) {
                    console.log("Adding point");
                    const point = {
                        x: event.position.x,
                        y: event.position.y,
                        z: tmapp.curr_z,
                        mclass: tmapp.curr_mclass
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
                    $("#focus_next").click();
                }
                else if (event.scroll < 0) {
                    $("#focus_prev").click();
                }
            }
        };

        // Live updates of mouse position in collaboration
        const moveHandler = function(event) {
            const pos = overlayUtils.pointFromOSDPixel(event.position, "ISS");
            tmapp.setCursorStatus({x: pos.x, y: pos.y});
        }

        // Live updates of whether or not the mouse is held down
        const heldHandler = function(held) {
            return function(event) {
                const pos = overlayUtils.pointFromOSDPixel(event.position, "ISS");
                tmapp.setCursorStatus({
                    held: held,
                    x: pos.x,
                    y: pos.y
                });
            };
        }

        // Live update of whether or not the mouse is in the viewport
        const insideHandler = function(inside) {
            return function(event) {
                const pos = overlayUtils.pointFromOSDPixel(event.position, "ISS");
                tmapp.setCursorStatus({
                    inside: inside,
                    x: pos.x,
                    y: pos.y
                });
            };
        }

        //OSD handlers have to be registered using MouseTracker OSD objects
        const ISS_mouse_tracker = new OpenSeadragon.MouseTracker({
            element: this.viewer.canvas,
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
                                    _moveTo(initialState);
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
        if (!_images.some((image) => image.name === imageName)) {
            tmappUI.displayImageError("badimage", 5000);
            throw new Error("Tried to change to an unknown image.");
        }
        markerPoints.clearPoints(false);
        $("#ISS_viewer").empty();
        _currentImage = imageName;
        _updateURLParams();
        _initOSD(callback);
    }

    return {
        init: init,
        openImage: openImage
    };
})();

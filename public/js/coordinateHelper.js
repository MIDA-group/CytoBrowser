/**
 * Namespace used for easily converting coordinates in the current image.
 * In order to use the functions, the active image first has to be set
 * with the {@link setImage} function. The different coordinate systems
 * that the functions convert between are described in more detail
 * {@link https://openseadragon.github.io/examples/viewport-coordinates/ |here.}
 * A function for coversion with so-called overlay coordinates is also
 * included as a workaround for a bug with mouse events in the overlay.
 * @namespace coordinateHelper
 */
const coordinateHelper = (function() {
    "use strict";
    let _activeImage,
        _minDimension;

    /**
     * Convert from image coordinates to viewport coordinates.
     * @param {Object} point A point in image coordinates.
     * @param {number} point.x The x coordinate of the point.
     * @param {number} point.y The y coordinate of the point.
     * @returns {Object} The same point in viewport coordinates.
     */
    function imageToViewport({x, y}){
        if (!_activeImage) {
            throw new Error("Can't find coordinates without setting an image first.");
        }
        return _activeImage.imageToViewportCoordinates(x, y);
    }

    /**
     * Convert from viewport coordinates to image coordinates.
     * @param {Object} point A point in viewport coordinates.
     * @param {number} point.x The x coordinate of the point.
     * @param {number} point.y The y coordinate of the point.
     * @returns {Object} The same point in image coordinates.
     */
    function viewportToImage({x, y}){
        if (!_activeImage) {
            throw new Error("Can't find coordinates without setting an image first.");
        }
        return _activeImage.viewportToImageCoordinates(x, y);
    }

    /**
     * Convert from image coordinates to web coordinates.
     * @param {Object} point A point in image coordinates.
     * @param {number} point.x The x coordinate of the point.
     * @param {number} point.y The y coordinate of the point.
     * @returns {Object} The same point in web coordinates.
     */
    function imageToWeb({x, y}){
        if (!_activeImage) {
            throw new Error("Can't find coordinates without setting an image first.");
        }
        const point = new OpenSeadragon.Point(x, y);
        return _activeImage.imageToViewerElementCoordinates(point);
    }

    /**
     * Convert from web coordinates to image coordinates.
     * @param {Object} point A point in web coordinates.
     * @param {number} point.x The x coordinate of the point.
     * @param {number} point.y The y coordinate of the point.
     * @returns {Object} The same point in image coordinates.
     */
    function webToImage({x, y}){
        if (!_activeImage) {
            throw new Error("Can't find coordinates without setting an image first.");
        }
        const point = new OpenSeadragon.Point(x, y);
        return _activeImage.viewerElementToImageCoordinates(point);
    }

    /**
     * Convert from web coordinates to viewport coordinates.
     * @param {Object} point A point in web coordinates.
     * @param {number} point.x The x coordinate of the point.
     * @param {number} point.y The y coordinate of the point.
     * @returns {Object} The same point in viewport coordinates.
     */
    function webToViewport({x, y}){
        return imageToViewport(webToImage({x, y})); //viewer.viewport.pointFromPixel(webPoint);
    }

    /**
     * Convert from viewport coordinates to web coordinates.
     * @param {Object} point A point in viewport coordinates.
     * @param {number} point.x The x coordinate of the point.
     * @param {number} point.y The y coordinate of the point.
     * @returns {Object} The same point in web coordinates.
     */
    function viewportToWeb({x, y}){
        return imageToWeb(viewportToImage({x, y}));
    }

    /**
     * Due to the workaround for getting overlay mouse events to work
     * in Firefox, this should be used on a point in viewport coordinates
     * to get the equivalent point in overlay coordinates.
     * @param {Object} point A point in viewport coordinates.
     * @param {number} point.x The x coordinate of the point.
     * @param {number} point.y The y coordinate of the point.
     * @returns {Object} The same point in overlay coordinates.
     */
    function viewportToOverlay({x, y}){
        return {x: x * 1000, y: y * 1000};
    }
    function overlayToViewport({x, y}){
        return {x: x / 1000, y: y / 1000};
    }

    function webToOverlay({x, y}){
        return viewportToOverlay(webToViewport({x, y}));
    }
    function overlayToWeb({x, y}){
        return viewportToWeb(overlayToViewport({x, y}));
    }

    function imageToOverlay({x, y}){
        return viewportToOverlay(imageToViewport({x, y}));
    }
    function overlayToImage({x, y}){
        return viewportToImage(overlayToViewport({x, y}));
    }
    
    /**
     * Convert from page coordinates, as acquired from pageX and pageY
     * on mouse events, to viewport coordinates.
     * @param {Object} point A point in page coordinates.
     * @param {number} point.x The x coordinate of the point.
     * @param {number} point.y The y coordinate of the point.
     * @returns {Object} The same point in viewport coordinates.
     */
    function pageToViewport({x, y}){
        const webCoords = {
            x: x - $("#ISS_viewer").offset().left,
            y: y - $("#ISS_viewer").offset().top
        };
        const viewportCoords = webToViewport(webCoords);
        return viewportCoords;
    }

    /**
     * Get the length of the shortest dimension of the image in image
     * coordinates.
     * @returns {number} The length in pixels.
     */
    function getMinDimension() {
        if (!_minDimension && _minDimension !== 0) {
            throw new Error ("Can't get the shortest dimension without an image.");
        }
        return _minDimension;
    }

    /**
     * Check whether or not a point is inside the image.
     * @param {Object} point A point in viewport coordinates.
     * @returns {boolean} Whether or not the point is inside the image.
     */
    function pointIsInsideViewport({x, y}) {
        if (!_activeImage) {
            throw new Error("Can't check insideness without setting an image first.");
        }
        const bounds = _activeImage.getBounds();
        return x > 0 && y > 0 && x < bounds.width && y < bounds.height;
    }

    /**
     * Check whether or not a point is inside the image.
     * @param {Object} point A point in web coordinates.
     * @returns {boolean} Whether or not the point is inside the image.
     */
    function pointIsInsideWeb({x, y}) {
        return pointIsInsideViewport(webToViewport({x, y}));
    }

    /**
     * Check whether or not a point is inside the image.
     * @param {Object} point A point in image coordinates.
     * @returns {boolean} Whether or not the point is inside the image.
     */
    function pointIsInsideImage({x, y}) {
        return pointIsInsideViewport(imageToViewport({x, y}));
    }

    /**
     * Set the coordinate helper to work with a given image. Due to
     * inaccuracies in coordinates when working with multiple images
     * in OpenSeadragon, this should be called with a specific image
     * in a stack whenever the focus changes.
     * @param {OpenSeadragon.TiledImage} image The currently active image.
     */
    function setImage(image) {
        _activeImage = image;
        const bounds = image.getBounds(); //in viewport coords
        const width = viewportToImage({x: 1, y: 0}).x;
        const height = bounds.height * width;
        _minDimension = Math.min(width, height); //in image coords
    }

    /**
     * Clear information about the current image.
     */
    function clearImage() {
        _activeImage = null;
        _minDimension = null;
    }

    return {
        imageToViewport,
        viewportToImage,

        imageToWeb,
        webToImage,

        webToViewport,
        viewportToWeb,

        viewportToOverlay,
        overlayToViewport,

        overlayToWeb,
        webToOverlay,

        imageToOverlay,
        overlayToImage,

        pageToViewport,

        getMinDimension,
        pointIsInsideViewport,
        pointIsInsideWeb,
        pointIsInsideImage,
        setImage,
        clearImage
    };
})();

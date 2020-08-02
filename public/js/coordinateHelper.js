/**
 * Namespace used for easily converting coordinates in the current image.
 * In order to use the functions, the active image first has to be set
 * with the {@link setImage} function. The different coordinate systems
 * that the functions convert between are described in more detail
 * {@link https://openseadragon.github.io/examples/viewport-coordinates/|here.}
 * A function for coversion with so-called overlay coordinates is also
 * included as a workaround for a bug with mouse events in the overlay.
 * @namespace coordinateHelper
 */
const coordinateHelper = (function() {
    "use strict";
    let _activeImage;

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
        return imageToViewport(webToImage({x, y}));
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
        return {x: x * 100, y: y * 100};
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
    }

    /**
     * Clear information about the current image.
     */
    function clearImage() {
        _activeImage = null;
    }

    return {
        imageToViewport: imageToViewport,
        viewportToImage: viewportToImage,
        imageToWeb: imageToWeb,
        webToImage: webToImage,
        webToViewport: webToViewport,
        viewportToWeb: viewportToWeb,
        setImage: setImage,
        clearImage: clearImage
    };
})();

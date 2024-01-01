/**
 * Functions for keeping track of the different CyBr layers.
 * @namespace layerHandler
 **/

const layerHandler = (function (){
    "use strict";

    const timingLog = false; //Log update times

    let _layers=[], //Sorted array of layers, first is active  (DesignQ: perhaps a Map instead?)
    
        //Keeping these layer properties, to suitably initialize new layers
        _zoomLevel,
        _wContainer,
        _scale,
        _maxScale,
        _rotation,
        _markerScale;


    function _forEachLayer(funStr, ...args) {
        _layers.forEach(item => typeof item[funStr] === 'function' && item[funStr](...args) );
    }
    function _forCurrentLayer(funStr, ...args) {
        const item = _layers[0];
        typeof item[funStr] === 'function' && item[funStr](...args);
    }


    function clearCurrentLayer() {
        _forCurrentLayer("clear");
    }
    function clearAllLayers() {
        _forEachLayer("clear");
    }


    /**
     * Let the layers know the current zoom level and maximum
     * zoom level of the viewer in order to properly scale elements.
     * @param {number} zoomLevel The current zoom level of the OSD viewport.
     * @param {number} wContainer The maximum zoom level of the OSD viewport.
     */
    function setZoom(zoomLevel, maxZoom, wContainer, hContainer) {
        const windowSizeAdjustment = 1400 / wContainer; //1000*sqrt(2)?
        _zoomLevel = zoomLevel;
        _wContainer = wContainer;
        _scale = windowSizeAdjustment / zoomLevel;
        _maxScale = windowSizeAdjustment / maxZoom;   

        _forEachLayer("setZoom", zoomLevel, maxZoom, wContainer, hContainer);
        _setScale();   
    }

    function _setScale() {
        _forEachLayer("setScale",_scale);
    }

    /**
     * Let the layers know the rotation of the viewport in order
     * to properly adjust any elements that need to be rotated.
     * @param {number} rotation The current rotation of the OSD viewport.
     */
    function setRotation(rotation) {
        _rotation = rotation;
        _forEachLayer("setRotation",_rotation);
    }

    /**
     * Adjusting the global marker scale
     * @param {number} mScale 
     */
    function setMarkerScale(mScale) {
        _markerScale = mScale;
        _forEachLayer("setMarkerScale",_markerScale);
    }

    /**
     * Everything which should be called for new layers
     */
    function _setLayerParams(layer) {
        layer.setScale?.(_scale);
        layer.setRotation?.(_rotation);
        layer.setMarkerScale?.(_rotation);
    }

    /**
     * Set z-index, with last layer at z=0 (avoiding z<0 due to various reported issues)
     */
    function _setZOrder() {
        for (let index = _layers.length-1, z=0; index >= 0; index--) {
            _layers[index].setZ(z++);
        }    
    }

    /**
     * Add new overlay layer
     * @param {layer Object} layer 
     * @param {string} name - duplicate names allowed (but not recommended)  
     * @param {boolean} first - put layer on top, otherwise last
     */
    function addLayer(layer, name, first=true) {
        layer.name = name;
        _setLayerParams(layer);
        if (first) {
            _layers.unshift(layer);
        }
        else {
            _layers.push(layer);
        }
        _setZOrder();
    }

    /**
     * Lookup layer (O(N))
     * @param {string} name 
     */
    function _getLayerIndex(name) {
        return _layers.findIndex((elem) => elem.name===name);
    }

    function _putLayerFirst(name) {
        const idx=_getLayerIndex(name);
        const layer=_layers.splice(idx,1)[0];
        _layers.unshift(layer);
        _setZOrder();
    }

    //function removeLayer(name) { Todo }

    /**
     * Set which layer should be able to receive mouse events
     * @param {string} name The name of the overlay, either "region" or
     * "marker".
     */
    function setTopLayer(name) {
        if (!_layers.length) return;
        _layers[0].blur();
        _putLayerFirst(name)
        _layers[0].focus();
    }

    function updateAnnotations(annotations) {
        _forEachLayer("updateAnnotations", annotations);
    }
    // Counter to check if we're busy rendering
    updateAnnotations.inProgress = (() => _layers.some((elem) => elem.updateAnnotations.inProgress()) );

    return {

        clearAnnotations:clearAllLayers,
        setZoom,
        setMarkerScale:setMarkerScale,
        setRotation,
        setActiveAnnotationOverlay:setTopLayer,

        addLayer,
        updateAnnotations
    };
})();

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
        _maxZoom,
        _rotation,
        _markerScale = 1; //Modifcation factor


    function _forEachLayer(funStr, ...args) {
        _layers.forEach(item => typeof item[funStr] === 'function' && item[funStr](...args) );
    }
    function _forEachNamedLayer(name,funStr, ...args) {
        _layers.forEach(item => item.name === name && typeof item[funStr] === 'function' && item[funStr](...args) );
    }
    function _forCurrentLayer(funStr, ...args) {
        const item = _layers[0];
        typeof item[funStr] === 'function' && item[funStr](...args);
    }


    function clearCurrentLayer() {
        _forCurrentLayer("clear");
    }
    function clearEachLayer() {
        _forEachLayer("clear");
    }
    function clear() {
        _layers=[];
    }

    /**
     * Let the layers know the current zoom level and maximum
     * zoom level of the viewer in order to properly scale elements.
     * @param {number} zoomLevel The current zoom level of the OSD viewport.
     * @param {number} wContainer The maximum zoom level of the OSD viewport.
     */
    function setZoom(zoomLevel, maxZoom, wContainer) {
        const windowSizeAdjustment = 1400 / wContainer; //1000*sqrt(2)?
        _zoomLevel = zoomLevel;
        _maxZoom = maxZoom;
        _wContainer = wContainer;
        _forEachLayer("setZoom", _zoomLevel, _maxZoom, _wContainer);
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
    function setMarkerScale(markerScale) {
        _markerScale = markerScale;
        _forEachLayer("setMarkerScale",_markerScale);
    }

    /**
     * Everything which should be called for new layers
     */
    function _setLayerParams(layer) {
        layer.setZoom(_zoomLevel,_maxZoom,_wContainer);
        layer.setRotation?.(_rotation);
        layer.setMarkerScale?.(_markerScale);
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
        _layers[0]?.blur();
        if (first) {
            _layers.unshift(layer);
        }
        else {
            _layers.push(layer);
        }
        _setZOrder();
        _layers[0].focus();

        console.log(_layers);
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

    function updateMembers(nonLocalMembers) {
        _forEachNamedLayer("region","updateMembers", nonLocalMembers);
    }
    
    return {
        topLayer: () => _layers[0],

        clearAnnotations:clearEachLayer,
        clear,
        setZoom,
        setMarkerScale,
        setRotation,
        setActiveAnnotationOverlay:setTopLayer,

        addLayer,
        updateAnnotations,
        updateMembers
    };
})();

/**
 * Functions for handling tools that can be used by clicking in the
 * OpenSeadragon viewport.
 * @namespace annotationTool
 */
const annotationTool = (function() {
    "use strict";

    const _markerTool = (function() {
        return {
            click: function(position) {
                const marker = {
                    points: [{
                        x: position.x,
                        y: position.y
                    }],
                    z: position.z,
                    mclass: _activeMclass
                };
                markerHandler.addMarker(marker, "viewport");
            }
        };
    })();

    const _rectTool = (function() {
        let _startPoint,
            _endPoint,
            _zLevel,
            _mclass;

        function _getAnnotation() {
            const points = [
                _startPoint,
                {x: _startPoint.x, y: _endPoint.y},
                _endPoint,
                {x: _endPoint.x, y: _startPoint.y}
            ];
            const annotation = {
                points: points,
                z: _zLevel,
                mclass: _mclass
            };
            return annotation;
        }

        function _updatePending() {
            const annotation = _getAnnotation();
            overlayHandler.updatePendingRegion(annotation);
        }

        function reset() {
            _startPoint = null;
            _endPoint = null;
            overlayHandler.updatePendingRegion(null);
        }

        return {
            click: function(position) {
                let coords = coordinateHelper.viewportToImage({
                    x: position.x,
                    y: position.y
                });
                _zLevel = position.z;
                _mclass = _activeMclass;
                if (_startPoint) {
                    _endPoint = coords;
                    const annotation = _getAnnotation();
                    markerHandler.addMarker(annotation, "image");
                    reset();
                }
                else
                    _startPoint = coords;
            },
            update: function(position) {
                if (_startPoint) {
                    _endPoint = coordinateHelper.viewportToImage({
                        x: position.x,
                        y: position.y
                    });
                    _updatePending();
                }
            },
            revert: reset,
            reset: reset
        };
    })();

    const _polyTool = (function() {
        let _points = [],
            _nextPoint,
            _zLevel,
            _mclass;

        function _getAnnotation(points) {
            return {
                points: points,
                z: _zLevel,
                mclass: _mclass
            };
        }

        function _updatePending(points) {
            const annotation = _getAnnotation([..._points, _nextPoint]);
            overlayHandler.updatePendingRegion(annotation);
        }

        function reset() {
            _points = [];
            _nextPoint = null;
            overlayHandler.updatePendingRegion(null);
        }

        return {
            click: function(position) {
                _nextPoint = coordinateHelper.viewportToImage({
                    x: position.x,
                    y: position.y
                });
                _zLevel = position.z;
                _mclass = _activeMclass;
                _points.push(_nextPoint);
                _updatePending();
            },
            dblClick: function(position) {
                _zLevel = position.z;
                _mclass = _activeMclass;
                if (_points.length > 2) {
                    const annotation = _getAnnotation(_points);
                    markerHandler.addMarker(annotation, "image");
                    reset();
                }
            },
            update: function(position) {
                if (_points.length) {
                    _nextPoint = coordinateHelper.viewportToImage({
                        x: position.x,
                        y: position.y
                    });
                    _updatePending();
                }
            },
            revert: function() {
                _points.pop();
                _updatePending();
                if (!_points.length)
                    reset();
            },
            reset: reset
        };
    })();

    const _tools = {
        marker: _markerTool,
        rect: _rectTool,
        poly: _polyTool
    };

    let _activeTool,
        _activeMclass;

    function _callToolFunction(funName, position) {
        if (!_activeTool)
            throw new Error("No tool has been selected.");
        const fun = _activeTool[funName];
        if (fun)
            fun(position);
    }

    function _replaceTool(newTool) {
        if (_activeTool && _activeTool !== newTool)
            reset();
        _activeTool = newTool;
    }

    /**
     * Set the currently active tool.
     * @param {string} toolName The name of the tool being used.
     */
    function setTool(toolName) {
        const tool = _tools[toolName];
        if (tool)
            _replaceTool(tool);
        else
            throw new Error("Invalid tool name.");
    }

    /**
     * Set the current marker class being assigned with the tool.
     * @param {string} mclass The currently active marker class.
     */
    function setMclass(mclass) {
        if (bethesdaClassUtils.getIDFromName(mclass) >= 0)
            _activeMclass = mclass;
        else
            throw new Error("Undefined marker class.");
    }

    /**
     * Perform a click in the viewport with the currently active tool.
     * @param {Object} position The position of the click.
     * @param {number} position.x The x coordinate in viewport coordinates.
     * @param {number} position.y The y coordinate in viewport coordinates.
     * @param {number} position.z The focus level.
     */
    function click(position) {
        _callToolFunction("click", position);
    }

    /**
     * Perform a double click in the viewport with the currently active tool.
     * @param {Object} position The position of the click.
     * @param {number} position.x The x coordinate in viewport coordinates.
     * @param {number} position.y The y coordinate in viewport coordinates.
     * @param {number} position.z The focus level.
     */
    function dblClick(position) {
        _callToolFunction("dblClick", position);
    }

    /**
     * Reset the currently used tool to an initial state.
     */
    function reset() {
        _callToolFunction("reset");
    }

    /**
     * Revert the last non-completing move made with the tool.
     */
    function revert() {
        _callToolFunction("revert");
    }

    /**
     * Let the active tool know that the mouse position has been updated
     * and carry out any appropriate actions.
     * @param {Object} position The position of the mouse.
     * @param {number} position.x The x coordinate in viewport coordinates.
     * @param {number} position.y The y coordinate in viewport coordinates.
     * @param {number} position.z The focus level.
     */
    function updateMousePosition(position) {
        _callToolFunction("update", position);
    }

    return {
        setTool: setTool,
        setMclass: setMclass,
        click: click,
        dblClick: dblClick,
        reset: reset,
        revert: revert,
        updateMousePosition: updateMousePosition
    };
})();

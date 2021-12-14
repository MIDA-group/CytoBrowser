/**
 * Functions for handling tools that can be used by clicking in the
 * OpenSeadragon viewport.
 * @namespace annotationTool
 */
const annotationTool = (function() {
    "use strict";

    // Tool for placing single-point markers
    const _markerTool = (function() {
        return {
            click: function(position) {
                const annotation = {
                    points: [{
                        x: position.x,
                        y: position.y
                    }],
                    z: position.z,
                    mclass: _activeMclass
                };
                annotationHandler.add(annotation, "viewport");
            }
        };
    })();

    // Tool for adding a rectangle by clicking opposing corners
    const _rectTool = (function() {
        let _startPoint,
            _endPoint,
            _zLevel,
            _mclass,
            _clicks = 0; //Counting clicks to i) allow dblClick to behave like click, while ii) not starting new rectangle on dblClick-complete

        function _getAnnotation() {
            const points = [
                _startPoint,
                {x: _startPoint.x, y: _endPoint.y}, //Diagonal corner
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
            _clicks = 0;
        }

        function addPoint(position) {
            _clicks++;
            let coords = coordinateHelper.viewportToImage({
                x: position.x,
                y: position.y
            });
            _zLevel = position.z;
            _mclass = _activeMclass;
            _endPoint = coords;
            if (_startPoint) {
                if (_startPoint.x === coords.x && _startPoint.y === coords.y) {
                    console.info("Zero sized rectangle (double click?), ignoring click.");
                    return;
                }
                complete(position);
            }
            else {
                _startPoint = coords;
                _updatePending();
            }
        }

        function complete(position) {
            _zLevel = position.z;
            _mclass = _activeMclass;
            if (_startPoint && _endPoint) {
                const annotation = _getAnnotation();
                annotationHandler.add(annotation, "image");
                reset();
            }
            else {
                console.warn("Complete called with incomplete rectangle!");
            }
        }

        return {
            click: addPoint,
            // Prevent starting a new rectangle by the two separate click events
            dblClick: function(position) {
                if (_clicks<2) { // only one click for this rect = new rect created from (half) dblClick-closing
                    console.info("Double-click close, reset to avoid creating new rectangle.");
                    reset();
                }
            },
            complete: addPoint,
            update: function(position) {
                if (_startPoint) {
                    _mclass = _activeMclass;
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

    // Tool for adding a free-form polygon
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

        function _updatePending() {
            const annotation = _getAnnotation([..._points, _nextPoint]);
            overlayHandler.updatePendingRegion(annotation);
        }

        function reset() {
            _points = [];
            _nextPoint = null;
            overlayHandler.updatePendingRegion(null);
        }

        function addPoint(position) {
            _nextPoint = coordinateHelper.viewportToImage({
                x: position.x,
                y: position.y
            });
            _zLevel = position.z;
            _mclass = _activeMclass;
            const last = _points.pop();
            if (last && (last.x !== _nextPoint.x || last.y !== _nextPoint.y))
                _points.push(last);
            if (mathUtils.pathIntersectsSelf([..._points, _nextPoint], false))
                return;
            _points.push(_nextPoint);
            _updatePending();
        }

        function complete(position) {
            _zLevel = position.z;
            _mclass = _activeMclass;
            if (_points.length > 2 && !mathUtils.pathIntersectsSelf(_points)) {
                const annotation = _getAnnotation(_points);
                annotationHandler.add(annotation, "image");
                reset();
            }
        }

        return {
            click: addPoint,
            dblClick: complete,
            complete: complete,
            update: function(position) {
                if (_points.length) {
                    _mclass = _activeMclass;
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
        _activeMclass,
        _lastPosition;

    function _callToolFunction(funName, position) {
        if (!_activeTool)
            return;
        if (position)
            _lastPosition = position;
        else
            position = _lastPosition;

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
        if (classUtils.getIDFromName(mclass) >= 0) {
            _activeMclass = mclass;
            _callToolFunction("update");
        }
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
     * Complete the currently active annotation.
     * @param {Object} position The position of the click.
     * @param {number} position.x The x coordinate in viewport coordinates.
     * @param {number} position.y The y coordinate in viewport coordinates.
     * @param {number} position.z The focus level.
     */
    function complete(position) {
        _callToolFunction("complete", position);
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
        complete: complete,
        reset: reset,
        revert: revert,
        updateMousePosition: updateMousePosition
    };
})();

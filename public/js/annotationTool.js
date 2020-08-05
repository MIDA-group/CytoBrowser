/**
 * Functions for handling tools that can be used by clicking in the
 * OpenSeadragon viewport.
 * @namespace annotationTool
 */
const annotationTool = (function() {
    "use strict";

    const _toolSymbols = {
        marker: Symbol("Marker tool"),
        rect: Symbol("Rectangular region tool"),
        poly: Symbol("Polygonal region tool")
    };
    const _tools = {
        [_toolSymbols.marker]: _markerTool,
        [_toolSymbols.rect]: _rectTool,
        [_toolSymbols.poly]: _polyTool
    };

    const _markerTool = (function() {
        function click(position) {
            const marker = {
                x: position.x,
                y: position.y,
                z: position.z,
                mclass: _mclass
            };
            markerHandler.addMarker(marker);
        }

        return {
            click: click
        };
    })();

    const _rectTool = (function() {
        function click(position) {
            console.log("Clicked with the rectangle tool!");
        }

        return {
            click: click
        };
    })();

    const _polyTool = (function() {
        function click(position) {
            console.log("Clicked with the polygon tool!");
        }

        return {
            click: click
        };
    })();

    let _activeTool,
        _mclass;

    function _callToolFunction(funName, position) {
        if (!_activeTool)
            throw new Error("No tool has been selected.");
        const fun = _activeTool[funName];
        if (fun)
            fun(position);
    }

    /**
     * Set the currently active tool.
     * @param {string} toolName The name of the tool being used.
     */
    function setTool(toolName) {
        const toolSymbol = _toolSymbols[toolName];
        if (toolSymbol)
            _activeTool = _tools[toolSymbol];
        else
            throw new Error("Invalid tool name.");
    }

    /**
     * Set the current marker class being assigned with the tool.
     * @param {string} mclass The currently active marker class.
     */
    function setMclass(mclass) {
        if (bethesdaClassUtils.getIDFromName(mclass) >= 0)
            _mclass = mclass;
        else
            throw new Error("Undefined marker class.");
    }

    /**
     * Perform a click in the viewport with the currently active tool.
     * @param {Object} position The position of the click.
     * @param {number} position.x The x coordinate in web coordinates.
     * @param {number} position.y The y coordinate in web coordinates.
     * @param {number} position.z The focus level.
     */
    function clickTool(position) {
        _callToolFunction("click", position);
    }

    /**
     * Let the active tool know that the mouse position has been updated
     * and carry out any appropriate actions.
     * @param {Object} position The position of the mouse.
     * @param {number} position.x The x coordinate in web coordinates.
     * @param {number} position.y The y coordinate in web coordinates.
     * @param {number} position.z The focus level.
     */
    function updateMousePosition(position) {
        _callToolFunction("update", position);
    }

    return {
        setTool: setTool,
        setMclass: setMclass,
        clickTool: clickTool,
        updateMousePosition: updateMousePosition
    };
})();

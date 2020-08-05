/**
 * Functions for handling tools that can be used by clicking in the
 * OpenSeadragon viewport.
 * @namespace annotationTool
 */
const annotationTool = (function() {
    "use strict";

    const _tools = {
        marker: Symbol("Marker tool"),
        rect: Symbol("Rectangular region tool"),
        poly: Symbol("Polygonal region tool")
    };
    const _toolFunctions = {
        [_tools.marker]: {
            click: _markerClick
        },
        [_tools.rect]: {
            click: _rectClick
        },
        [_tools.poly]: {
            click: _polyClick
        }
    };
    let _activeTool;
    let _mclass;

    function _markerClick(position) {
        const marker = {
            x: position.x,
            y: position.y,
            z: position.z,
            mclass: _mclass
        };
        markerHandler.addMarker(marker);
    }

    function _rectClick(position) {
        console.log("Clicked with the rectangle tool!");
    }

    function _polyClick(position) {
        console.log("Clicked with the polygon tool!");
    }

    /**
     * Set the currently active tool.
     * @param {string} toolName The name of the tool being used.
     */
    function setTool(toolName) {
        const tool = _tools[toolName];
        if (tool)
            _activeTool = tool;
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
        if (_activeTool)
            _toolFunctions[_activeTool].click(position);
        else
            throw new Error("No tool has been selected.");
    }

    return {
        setTool: setTool,
        setMclass: setMclass,
        clickTool: clickTool
    }
})();

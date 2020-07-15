const overlayHandler = (function (){
    "use strict";

    let _cursorOverlay;

    /**
     * Use d3 to update the collaboration cursors, adding new ones and
     * removing old ones.
     * @param {Array} cursors An array of cursor data
     */
    function updateCursors(cursors) {
        const selection = _cursorOverlay.selectAll("rect")
            .data(cursors, (d) => d.id)
            .join("rect")
                .attr("x", (d) => d.x)
                .attr("y", (d) => d.y)
                .attr("height", 0.01)
                .attr("width", 0.01)
                .style("fill", "rgb(255,0,0)");
    }

    /**
     * Initialize the overlay handler. Should be called whenever OSD is
     * initialized.
     * @param {Object} svgOverlay The return value of the OSD instance's
     * svgOverlay() method.
     */
    function init(svgOverlay) {
        const cursors = d3.select(svgOverlay.node())
            .append("g")
            .attr("id", "cursors");
        _cursorOverlay = d3.select(cursors.node());
    }

    return {
        updateCursors: updateCursors,
        init: init
    };
})();

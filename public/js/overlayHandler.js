const overlayHandler = (function (){
    "use strict";

    let _cursorOverlay;

    /**
     * Use d3 to update the collaboration cursors, adding new ones and
     * removing old ones.
     * @param {Array} nonLocalMembers An array of members, excluding the
     * local member.
     */
    function updateMembers(nonLocalMembers) {
        const visibleMembers = nonLocalMembers.filter((member) => {
            return member.position.mouse
        });

        const selection = _cursorOverlay.selectAll("g")
            .data(visibleMembers, (d) => d.id)
            .join("g")
                .attr("transform", (d) => `translate(${d.position.mouse.x}, ${d.position.mouse.y}), scale(0.01, 0.01)`);
                .append("rect")
                .attr("x", 0)
                .attr("y", 0)
                .attr("height", 1)
                .attr("width", 1)
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
        updateMembers: updateMembers,
        init: init
    };
})();

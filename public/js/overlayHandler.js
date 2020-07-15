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
            .join(enter => enter.append("g").attr("transform", (d) => `translate(${d.position.mouse.x}, ${d.position.mouse.y}), scale(0.003, 0.003)`)
                                .append("path")
                                .attr("d", "M 0 0 L 0.2 1.0 L 0.457129 0.72534 L 0.81584 0.61188 Z")
                                .style("fill", "rgb(173, 29, 40)"),
                  update => update.attr("transform", (d) => `translate(${d.position.mouse.x}, ${d.position.mouse.y}), scale(0.003, 0.003)`));
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

const overlayHandler = (function (){
    "use strict";

    let _cursorOverlay,
        _previousCursors;

    /**
     * Use d3 to update the collaboration cursors, adding new ones and
     * removing old ones.
     * @param {Array} nonLocalMembers An array of members, excluding the
     * local member.
     */
    function updateMembers(nonLocalMembers) {
        const visibleMembers = nonLocalMembers.filter((member) => {
            return member.cursor;
        });

        _cursorOverlay.selectAll("g")
            .data(visibleMembers, (d) => d.id)
            .join(enter => {
                const group = enter.append("g")
                    .attr("transform", (d) => `translate(${d.cursor.x}, ${d.cursor.y}), rotate(-30), scale(0.003)`)
                    .attr("opacity", 0.0);
                group.append("path")
                    .attr("d", "M 0 0 L -0.4 1.0 L 0 0.7 L 0.4 1.0 Z")
                    .attr("class", "pointer")
                    .style("fill", "rgb(173, 29, 40)");
                group.append("path")
                    .attr("d", "M -0.4 1.0 L -0.36 1.2 L 0.36 1.2 L 0.4 1.0 L 0 0.7 Z")
                    .attr("class", "caret")
                    .style("fill", "rgb(173, 29, 40)")
                    .transition().duration(500)
                    .attr("transform", "translate(0, 0.15)");
                group.transition().duration(500)
                    .attr("opacity", 1.0);
                },
                update => {
                    update
                        .attr("transform", (d) => `translate(${d.cursor.x}, ${d.cursor.y}), rotate(-30), scale(${d.cursor.inside || d.cursor.held ? 0.003 : 0.0028})`)
                        .transition().duration(100)
                        .style("opacity", (d) => d.cursor.inside || d.cursor.held ? 1.0 : 0.2)
                        .attr("transform", (d) => `translate(${d.cursor.x}, ${d.cursor.y}), rotate(-30), scale(${d.cursor.inside || d.cursor.held ? 0.003 : 0.0028})`);
                    update.select(".caret")
                        .filter(function(d) { return _previousCursors.get(this).held !== d.cursor.held })
                        .transition().duration(200)
                        .attr("transform", (d) => `translate(0, ${d.cursor.held ? 0.05 : 0.15})`);
                }
            );

        _cursorOverlay.selectAll("g").property(_previousCursors, d => d.cursor);
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
        _previousCursors = d3.local();
    }

    return {
        updateMembers: updateMembers,
        init: init
    };
})();

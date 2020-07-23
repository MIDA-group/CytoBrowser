/**
 * Namespace for handling any local visual representation of markers.
 * @namespace markerVisuals
 */
const markerVisuals = (function() {
    "use strict";

    const tableId = "tmcptablebody";

    /**
     * Update the current visuals for the markers.
     * @param {Array} points All currently placed markers.
     */
    function update(points){
        // Update the markers in the overlay
        overlayHandler.updateMarkers(points);

        // Update the marker list
        const table = d3.select(`#${tableId}`);
        table.selectAll("tr")
            .data(points, d => d.id)
            .join(
                enter => {
                    const row = enter.append("tr");
                    row.append("td")
                        .attr("class", "align-middle")
                        .text(d => d.id);
                    row.append("td")
                        .attr("class", "align-middle")
                        .text(d =>
                            `(x: ${Math.round(d.x)}, y: ${Math.round(d.y)}, z: ${Math.round(d.z)})`)
                        .append("span")
                            .attr("class", "badge text-white ml-4")
                            .style("background-color", d =>
                                bethesdaClassUtils.classColor(d.mclass))
                            .text(d => d.mclass);
                    row.append("td")
                        .attr("class", "align-middle")
                        .append("button")
                            .attr("class", "btn btn-sm btn-link")
                            .attr("type", "button")
                            .text("Move to marker")
                            .on("click", d => tmapp.moveToPoint(d.id));
                },
                update => {
                    const cells = update.selectAll("td");
                    const idCell = d3.select(cells[0]);
                    const annotationCell = d3.select(cells[1]);
                    idCell.text(d => d.id);
                    annotationCell.text(d =>
                        `(x: ${Math.round(d.x)}, y: ${Math.round(d.y)}, z: ${Math.round(d.z)})`)
                        .append("span")
                            .attr("class", "badge text-white ml-4")
                            .style("background-color", d =>
                                bethesdaClassUtils.classColor(d.mclass))
                            .text(d => d.mclass);
                }
            );
    }

    return {
        update: update
    };
})();

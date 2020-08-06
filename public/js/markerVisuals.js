/**
 * Namespace for handling any local visual representation of markers.
 * @namespace markerVisuals
 */
const markerVisuals = (function() {
    "use strict";

    const _tableId = "tmcptablebody";

    /**
     * Update the current visuals for the markers.
     * @param {Array} markers All currently placed markers.
     */
    function update(markers){
        // Update the markers in the overlay
    	overlayHandler.updateMarkers(markers);

        // Update the marker list
        const table = d3.select(`#${_tableId}`);
        table.selectAll("tr")
            .data(markers, d => d.id)
            .join(
                enter => {
                    const row = enter.append("tr");
                    row.append("td")
                        .attr("class", "align-middle")
                        .text(d => d.id);
                    row.append("td")
                        .attr("class", "align-middle")
                        .text(d =>
                            `(x: ${Math.round(d.points[0].x)}, y: ${Math.round(d.points[0].y)}, z: ${Math.round(d.z)})`)
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
                            .on("click", d => tmapp.moveToMarker(d.id));
                },
                update => {
                    const cells = update.selectAll("td");
                    const idCell = cells.filter((d, i) => i === 0);
                    const annotationCell = cells.filter((d, i) => i === 1);
                    idCell.text(d => d.id);
                    annotationCell.text(d =>
                        `(x: ${Math.round(d.points[0].x)}, y: ${Math.round(d.points[0].y)}, z: ${Math.round(d.z)})`)
                        .append("span")
                            .attr("class", "badge text-white ml-4")
                            .style("background-color", d =>
                                bethesdaClassUtils.classColor(d.mclass))
                            .text(d => d.mclass);
                }
            );
    }

    /**
     * Clear all markers from the overlay. This function should
     * be called whenever markers are to be quickly cleared and
     * readded, e.g. when loading markers from a collab summary.
     * Since the marker elements will remain until their animation
     * has finished when removing them, d3 will think that they
     * still exist when calling update() before calling this function.
     */
    function clear(){
    	// TODO: This function shouldn't have to exist, update() should be enough
    	overlayHandler.clearMarkers();
    }


    return {
        update: update,
        clear: clear
    };
})();

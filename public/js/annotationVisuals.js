/**
 * Namespace for handling any local visual representation of annotations.
 * @namespace annotationVisuals
 */
const annotationVisuals = (function() {
    "use strict";

    const _tableId = "tmcptablebody";

    /**
     * Fill a cell of the annotation list with information about the
     * annotation's position, class, type and how many comments it has.
     * @param {d3.selection} annotationCell The d3 selection of the
     * cell being filled.
     */
    function _annotationContent(annotationCell) {
        annotationCell.text(d =>
            `(x: ${Math.round(d.centroid.x)}, y: ${Math.round(d.centroid.y)}, z: ${Math.round(d.z)})`)
            .call(cell =>
                cell.append("span")
                    .attr("class", "badge text-white ml-4")
                    .style("background-color", d =>
                        bethesdaClassUtils.classColor(d.mclass))
                    .text(d => d.mclass)
            )
            .call(cell =>
                cell.filter(d => d.points.length > 1)
                    .append("span")
                    .attr("class", "badge bg-dark text-white ml-4")
                    .text("Region")
            )
            .call(cell =>
                cell.filter(d => d.comments && d.comments.length)
                    .append("span")
                    .attr("class", "badge bg-dark text-white ml-4")
                    .text(d => `${d.comments.length} comment${d.comments.length > 1 ? "s" : ""}`)
            )
    }

    /**
     * Update the current visuals for the annotations.
     * @param {Array} annotations All currently placed annotations.
     */
    function update(annotations){
        // Update the annotations in the overlay
    	overlayHandler.updateAnnotations(annotations);

        // Update the annotation list
        const table = d3.select(`#${_tableId}`);
        table.selectAll("tr")
            .data(annotations, d => d.id)
            .join(
                enter => {
                    const row = enter.insert("tr", ":first-child");
                    row.append("td")
                        .attr("class", "align-middle")
                        .text(d => d.id);
                    row.append("td")
                        .attr("class", "align-middle")
                        .call(_annotationContent);
                    row.append("td")
                        .attr("class", "align-middle")
                        .append("button")
                            .attr("class", "btn btn-sm btn-link")
                            .attr("type", "button")
                            .text("Move to center")
                            .on("click", d => tmapp.moveToAnnotation(d.id));
                },
                update => {
                    const cells = update.selectAll("td");
                    const idCell = cells.filter((d, i) => i === 0);
                    const annotationCell = cells.filter((d, i) => i === 1);
                    idCell.text(d => d.id);
                    annotationCell.call(_annotationContent);
                }
            );
    }

    /**
     * Clear all annotations from the overlay. This function should
     * be called whenever annotations are to be quickly cleared and
     * readded, e.g. when loading annotations from a collab summary.
     * Since the annotation elements will remain until their animation
     * has finished when removing them, d3 will think that they
     * still exist when calling update() before calling this function.
     */
    function clear(){
    	// TODO: This function shouldn't have to exist, update() should be enough
    	overlayHandler.clearAnnotations();
    }


    return {
        update: update,
        clear: clear
    };
})();

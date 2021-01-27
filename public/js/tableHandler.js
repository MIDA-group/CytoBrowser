/**
 * Namespace for dealing with any tables shown on the page using d3.
 * @namespace tableHandler
 */
const tableHandler = (function() {
    "use strict";

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
            );
    }

    function _predictionContent(predictionCell) {
        predictionCell.text(d =>
            `(x: ${Math.round(d.x)}, y: ${Math.round(d.y)}, z: ${Math.round(d.z)})`)
            .call(cell =>
                cell.append("span")
                    .attr("class", "badge text-white ml-4")
                    .style("background-color", d =>
                        bethesdaClassUtils.classColor(d.mclass))
                    .text(d => d.mclass)
            );
    }

    /**
     * General function for updating any table that describes a location
     * in the viewport that can be moved to.
     * @param {string} tableId The id of the DOM element for the table.
     * @param {Array} data An array of data points. Each data point must
     * have a field named `id` to properly handle entries.
     * @param {Function} contentFun Function to be called with the data
     * to generate the content.
     * @param {Function} moveFun Function to be called with the id
     * when the "Move to" button is clicked.
     */
    function updateLocationTable(tableId, data, contentFun, moveFun) {
        const table = d3.select(`#${tableId}`);
        table.selectAll("tr")
            .data(data, d => d.id)
            .join(
                enter => {
                    const row = enter.insert("tr", ":first-child");
                    row.append("td")
                        .attr("class", "align-middle")
                        .text(d => d.id);
                    row.append("td")
                        .attr("class", "align-middle")
                        .call(contentFun);
                    row.append("td")
                        .attr("class", "align-middle")
                        .append("button")
                            .attr("class", "btn btn-sm btn-link")
                            .attr("type", "button")
                            .text("Move to")
                            .on("click", d => moveFun(d.id));
                },
                update => {
                    const cells = update.selectAll("td");
                    const idCell = cells.filter((d, i) => i === 0);
                    const annotationCell = cells.filter((d, i) => i === 1);
                    idCell.text(d => d.id);
                    annotationCell.call(contentFun);
                }
            );
    }

    /**
     * Update the table of annotations.
     * @param {Array} annotations All currently placed annotations.
     */
    function updateAnnotations(annotations) {
        updateLocationTable(
            "tmcptablebody",
            annotations,
            _annotationContent,
            tmapp.moveToAnnotation
        );
    }

    /**
     * Update the table of predictions.
     * @param {Array} predictions All currently placed predictions.
     */
    function updatePredictions(predictions) {
        updateLocationTable(
            "predtablebody",
            predictions,
            _predictionContent,
            tmapp.moveToPrediction
        );
    }

    return {
        updateTable: updateTable,
        updateAnnotations: updateAnnotations,
        updatePredictions: updatePredictions
    };
})();

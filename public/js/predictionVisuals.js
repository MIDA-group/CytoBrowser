/**
 * Namespace for handling the visual representation of predictions by
 * the model.
 * @namespace predictionVisuals
 */
const predictionVisuals = (function() {
    "use strict";

    const _tableId = "predtablebody";

    // TODO: Very similar behaviour in annotationVisuals, could refactor
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
     * Update the current visuals for the predictions.
     * @param {Array} predictions All currently placed predictions.
     */
    function update(predictions) {
        overlayHandler.updatePredictions(predictions);

        const table = d3.select(`#${_tableId}`);
        table.selectAll("tr")
            .data(predictions, d => d.id)
            .join(
                enter => {
                    const row = enter.insert("tr", ":first-child");
                    row.append("td")
                        .attr("class", "align-middle")
                        .text(d => d.id);
                    row.append("td")
                        .attr("class", "align-middle")
                        .call(_predictionContent);
                    row.append("td")
                        .attr("class", "align-middle")
                        .append("button")
                            .attr("class", "btn btn-sm btn-link")
                            .attr("type", "button")
                            .text("Move to center")
                            .on("click", d => tmapp.moveToPrediction(d.id));
                },
                update => {
                    const cells = update.selectAll("td");
                    const idCell = cells.filter((d, i) => i === 0);
                    const annotationCell = cells.filter((d, i) => i === 1);
                    idCell.text(d => d.id);
                    annotationCell.call(_predictionContent);
                }
            )
    }

    return {
        update: update
    };
})();

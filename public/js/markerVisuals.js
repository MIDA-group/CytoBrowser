const markerVisuals = (function() {
    function update(points){
        // Update the markers in the overlay
        overlayHandler.updateMarkers(points);

        // Update the marker list
        const table = d3.select("#tmcptablebody");
        table.selectAll("tr")
            .data(points)
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
                }
            );
    }

    return {
        update: update
    };
})();

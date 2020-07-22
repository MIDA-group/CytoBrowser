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
                        .class("align-middle")
                        .text(d => d.id);
                    row.append("td")
                        .class("align-middle")
                        .text(d => d);
                    row.append("td")
                        .class("align-middle")
                        .append("button")
                            .class("btn")
                            .class("btn-sm")
                            .class("btn-link")
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

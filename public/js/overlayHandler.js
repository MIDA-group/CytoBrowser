const overlayHandler = (function (){
    "use strict";

    let _cursorOverlay,
        _markerOverlay,
        _previousCursors,
        _scale;

    function _editTransform(transformString, changes) {
        // Turn the transform string into an object
        // Start by finding all the transforms
        const transforms = transformString.match(/[^\s,]+\([^)]*\)/g);

        // Structure the transform as an object
        const transObj = {};
        const names = transforms.map((transform) => transform.match(/.+(?=\()/g)[0]);
        transforms.forEach((transform) => {
            const name = transform.match(/.+(?=\()/g);
            const values = transform.match(/(?<=\(.*)[^\s,]+(?=.*\))/g);
            transObj[name] = values;
        });

        // Assign the changes
        let result = "";
        names.forEach((name) => {
            const value = changes[name];
            if (value) {
                if (Array.isArray(value)) {
                    transObj[name] = value;
                }
                else if (typeof value === "function") {
                    transObj[name] = transObj[name].map(value);
                }
                else if (typeof value !== "object") {
                    transObj[name] = [value];
                }
                else {
                    throw new Error("Invalid transform change.");
                }
            }
            result += `${name}(${transObj[name].toString()}) `;
        });

        return result;
    }

    function _cursorSize(cursor) {
        const normalSize = cursor.inside || cursor.held;
        return (normalSize ? 15 : 12) / _scale;
    }

    function _resizeMembers() {
        _cursorOverlay.selectAll("g")
            .attr("transform", function() {
                const cursor = _previousCursors.get(this);
                const currTrans = this.getAttribute("transform");
                const newTrans = _editTransform(currTrans, {scale: _cursorSize(cursor)});
                return newTrans;
            });
    }

    function _addMarkerMouseEvents(node) {
        new OpenSeadragon.MouseTracker({
            element: node,
            enterHandler: () => console.log("Mouse entered!"),
            exitHandler: () => console.log("Mouse exited!")
        }).setTracking(true);
    }

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
                    .attr("transform", (d) => `translate(${d.cursor.x}, ${d.cursor.y}), rotate(-30), scale(${_cursorSize(d.cursor)})`)
                    .attr("opacity", 0.0)
                    .style("fill", (d) => d.color);
                group.append("path")
                    .attr("d", "M 0 0 L -0.4 1.0 L 0 0.7 L 0.4 1.0 Z")
                    .attr("class", "pointer")
                group.append("path")
                    .attr("d", "M -0.4 1.0 L -0.36 1.2 L 0.36 1.2 L 0.4 1.0 L 0 0.7 Z")
                    .attr("class", "caret")
                    .transition().duration(500)
                    .attr("transform", "translate(0, 0.15)");
                group.transition().duration(100)
                    .attr("opacity", 1.0);
                },
                update => {
                    update.attr("transform", function(d) {
                            const currTrans = this.getAttribute("transform");
                            const newTrans = _editTransform(currTrans, {
                                translate: [d.cursor.x, d.cursor.y]
                            });
                            return newTrans;
                        })
                        .filter(function(d) { return _previousCursors.get(this).inside !== d.cursor.inside })
                        .transition().duration(200)
                        .style("opacity", (d) => d.cursor.inside || d.cursor.held ? 1.0 : 0.2)
                        .attr("transform", function(d) {
                            const currTrans = this.getAttribute("transform");
                            const newTrans = _editTransform(currTrans, {
                                scale: _cursorSize(d.cursor)
                            });
                            return newTrans;
                        });
                    update.select(".caret")
                        .filter(function(d) { return _previousCursors.get(this).held !== d.cursor.held })
                        .transition().duration(150)
                        .attr("transform", (d) => `translate(0, ${d.cursor.held ? 0.05 : 0.15})`);
                }
            );

        _cursorOverlay.selectAll("g").property(_previousCursors, d => d.cursor);
    }

    function updateMarkers(points){ // TODO: Inconsistent naming, go with either points or markers
        // TODO: Implement this
        console.log("Not yet implemented.");
        console.log(points);

        // TODO: put these options somewhere else
        const radius = 0.01;
        const strokeWidth = 0.02;
        const strokeColor = "#F00";


        _markerOverlay.selectAll("g")
            .data(points, (d) => d.id)
            .join(
                enter => {
                    const group = enter.append("g")
                        .attr("transform", d => {
                            const coords = coordinateHelper.imageToViewport(d);
                            return `translate(${coords.x}, ${coords.y}) scale(${radius})`;
                        })
                        .each(function() {_addMarkerMouseEvents(this);});
                    group.append("path")
                        .attr("d", d3.symbol().size(1/8).type(d3.symbolSquare))
                    	.attr("transform", "rotate(0) scale(0)")
            			.attr("stroke-width", strokeWidth)
            			.attr("stroke", d => bethesdaClassUtils.classColor(d.mclass))
                        .style("fill","rgba(0,0,0,0.2)")
                        .transition().duration(500)
                        .attr("transform", function(d) {
                            const currTrans = this.getAttribute("transform");
                            const newTrans = _editTransform(currTrans, {
                                rotate: 45,
                                scale: 1
                            });
                            return newTrans;
                        });
                    group.append("path")
                        .attr("d", d3.symbol().size(1/32).type(d3.symbolCircle))
                        .attr("transform", "scale(0)")
                        .attr("stroke-width", strokeWidth / 2)
                        .attr("stroke", "gray")
                        .style("fill", "transparent")
                        .transition().delay(500).duration(200)
                        .attr("transform", function(d) {
                            const currTrans = this.getAttribute("transform");
                            const newTrans = _editTransform(currTrans, {
                                scale: 1
                            });
                            return newTrans;
                        });
                },
                update => {
                    update.attr("transform", function(d) {
                            const currTrans = this.getAttribute("transform");
                            const coords = coordinateHelper.imageToViewport(d);
                            const newTrans = _editTransform(currTrans, {
                                translate: [coords.x, coords.y]
                            });
                            return newTrans;
                        });
                }
            );
    }

    /**
     * Let the overlay handler know the current zoom level and container
     * size of the viewer in order to properly scale elements.
     * @param {number} zoomLevel The current zoom level of the OSD viewport.
     * @param {number} wContainer The width in pixels of the OSD viewport.
     * @param {number} hContainer The height in pixels of the OSD viewport.
     */
    function setOverlayScale(zoomLevel, wContainer, hContainer) {
        _scale = zoomLevel * wContainer;
        _resizeMembers();
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
        const markers = d3.select(svgOverlay.node())
            .append("g")
            .attr("id", "markers");
        _cursorOverlay = d3.select(cursors.node());
        _markerOverlay = d3.select(markers.node());
        _previousCursors = d3.local();
    }

    return {
        updateMembers: updateMembers,
        updateMarkers: updateMarkers,
        setOverlayScale: setOverlayScale,
        init: init
    };
})();

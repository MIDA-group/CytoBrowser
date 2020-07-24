/**
 * Functions for updating the OpenSeadragon overlay.
 * @namespace overlayHandler
 **/
const overlayHandler = (function (){
    "use strict";

    const _markerSquareSize = 1/8,
        _markerCircleSize = 1/32,
        _markerSquareStrokeWidth = 0.02,
        _markerCircleStrokeWidth = 0.01,
        _markerText = true;

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
        const names = transforms.map(transform => transform.match(/.+(?=\()/g)[0]);
        transforms.forEach(transform => {
            const name = transform.match(/.+(?=\()/g);
            const values = transform.match(/(?<=\(.*)[^\s,]+(?=.*\))/g);
            transObj[name] = values;
        });

        // Assign the changes
        let result = "";
        names.forEach(name => {
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

    function _transformFunction(transform) {
        function f(d, i) {
            let appliedTransform;
            if (typeof transform === "function") {
                appliedTransform = transform(d, i);
            }
            else {
                appliedTransform = transform;
            }
            const currTransform = this.getAttribute("transform");
            return _editTransform(currTransform, appliedTransform);
        }
        return f;
    }

    function _cursorSize(cursor) {
        const normalSize = cursor.inside || cursor.held;
        return (normalSize ? 15 : 12) / _scale;
    }

    function _markerSize() {
        return 100 / Math.max(_scale, 20000);
    }

    function _resizeMembers() {
        _cursorOverlay.selectAll("g")
            .attr("transform", _transformFunction(function() {
                const cursor = _previousCursors.get(this);
                return {scale: _cursorSize(cursor)};
            }));
    }

    function _resizeMarkers() {
        _markerOverlay.selectAll("g")
            .attr("transform", _transformFunction({scale: _markerSize()}));
    }

    function _addMarkerMouseEvents(d, node) {
        new OpenSeadragon.MouseTracker({
            element: node,
            dragHandler: function(event) {
                const reference = coordinateHelper.webToImage({x: 0, y: 0});
                const delta = coordinateHelper.webToImage(event.delta);
                d.x += delta.x - reference.x;
                d.y += delta.y - reference.y;
                markerHandler.updateMarker(d.id, d, "image");
            },
            clickHandler: function(event) {
                if (event.originalEvent.ctrlKey) {
                    markerHandler.removeMarker(d.id);
                }
            },
            enterHandler: function(){
                d3.select(node)
                    .selectAll("path")
                    .transition().duration(200)
                    .attr("transform", _transformFunction({
                        scale: 1.25,
                        rotate: 45
                    }));
                d3.select(node)
                    .selectAll("text")
                    .transition().duration(200)
                    .style("opacity", 1);
            },
            exitHandler: function(){
                d3.select(node)
                    .selectAll("path")
                    .transition().duration(200)
                    .attr("transform", _transformFunction({
                        scale: 1.0,
                        rotate: 45
                    }));
                d3.select(node)
                    .selectAll("text")
                    .transition().duration(200)
                    .style("opacity", 0);
            }
        }).setTracking(true);
    }

    /**
     * Use d3 to update the collaboration cursors, adding new ones and
     * removing old ones.
     * @param {Array} nonLocalMembers An array of members, excluding the
     * local member.
     */
    function updateMembers(nonLocalMembers) {
        const visibleMembers = nonLocalMembers.filter(member => {
            return member.cursor;
        });

        _cursorOverlay.selectAll("g")
            .data(visibleMembers, d => d.id)
            .join(enter => {
                const group = enter.append("g")
                    .attr("transform", d => `translate(${d.cursor.x}, ${d.cursor.y}), rotate(-30), scale(${_cursorSize(d.cursor)})`)
                    .attr("opacity", 0.0)
                    .style("fill", d => d.color);
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
                    update.attr("transform", _transformFunction(function(d) {
                            return {translate: [d.cursor.x, d.cursor.y]};
                        }))
                        .filter(function(d) { return _previousCursors.get(this).inside !== d.cursor.inside })
                        .transition().duration(200)
                        .style("opacity", d => d.cursor.inside || d.cursor.held ? 1.0 : 0.2)
                        .attr("transform", _transformFunction(function(d) {
                            return {scale: _cursorSize(d.cursor)};
                        }));
                    update.select(".caret")
                        .filter(function(d) { return _previousCursors.get(this).held !== d.cursor.held })
                        .transition().duration(150)
                        .attr("transform", d => `translate(0, ${d.cursor.held ? 0.05 : 0.15})`);
                }
            );

        _cursorOverlay.selectAll("g").property(_previousCursors, d => d.cursor);
    }

    /**
     * Clear all markers currently in the overlay, in case you need to quickly replace them.
     */
    function clearMarkers(){
        if (!_markerOverlay) {
            return;
        }
        _markerOverlay.selectAll("g").remove();
    }


    /**
     * Use d3 to update markers, adding new ones and removing old ones.
     * The markers are identified by their id.
     * @param {Array} markers The currently placed markers.
     */
    function updateMarkers(markers){
        _markerOverlay.selectAll("g")
            .data(markers, d => d.id)
            .join(
                enter => {
                    const group = enter.append("g")
                        .attr("transform", d => {
                            const coords = coordinateHelper.imageToViewport(d);
                            return `translate(${coords.x}, ${coords.y}) scale(${_markerSize()})`;
                        })
                        .attr("opacity", 1);
                    const square = group.append("path")
                        .attr("d", d3.symbol().size(_markerSquareSize).type(d3.symbolSquare))
                    	.attr("transform", "rotate(0) scale(0)")
            			.attr("stroke-width", _markerSquareStrokeWidth)
            			.attr("stroke", d => bethesdaClassUtils.classColor(d.mclass))
                        .style("fill","rgba(0,0,0,0.2)");
                    group.each(function(d) {_addMarkerMouseEvents(d, this);});
                    square.transition().duration(500)
                        .attr("transform", _transformFunction({
                            rotate: 45,
                            scale: 1
                        }));
                    group.append("path")
                        .attr("d", d3.symbol().size(_markerCircleSize).type(d3.symbolCircle))
                        .attr("transform", "scale(0)")
                        .attr("stroke-width", _markerCircleStrokeWidth)
                        .attr("stroke", "gray")
                        .style("fill", "transparent")
                        .style("pointer-events", "none")
                        .transition().delay(300).duration(200)
                        .attr("transform", _transformFunction({
                            scale: 1
                        }));
                    if (_markerText) {
                        group.append("text")
                            .style("fill", d => bethesdaClassUtils.classColor(d.mclass))
                            .style("font-size", "1%")
                            .style("font-weight", "700")
                            .style("pointer-events", "none")
                            .style("opacity", 0)
                            .attr("text-anchor", "left")
                            .attr("transform", "translate(0.2, -0.2)")
                            .text(d => `#${d.id}: ${d.mclass}`);
                    }
                },
                update => {
                    update.attr("transform", _transformFunction(function(d) {
                            const coords = coordinateHelper.imageToViewport(d);
                            return {translate: [coords.x, coords.y]};
                        }));
                },
                exit => {
                    exit.transition().duration(200)
                        .attr("opacity", 0)
                        .attr("transform", _transformFunction({
                            scale: s => 2 * s
                        }))
                        .remove();
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
        _resizeMarkers();
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
        clearMarkers: clearMarkers,
        setOverlayScale: setOverlayScale,
        init: init
    };
})();

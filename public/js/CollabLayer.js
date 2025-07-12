"use strict";
/**
 * Class for the collaborator info overlay (e.g. mouse cursors).
 **/

class CollabLayer extends OverlayLayer {
    #scale;

    #cursorOverlay;
    #previousCursors;

    /**
     * @param {string} name - Typically "collab"
     * @param {Object} svgOverlay - svgOverlay() of the OSD
     */
    constructor(name, svgOverlay) {
        super(name);
     
        this.#cursorOverlay = d3.select(svgOverlay.node())
            .append("g")
            .attr("id", "cursors")
            .style("pointer-events", "none");
        this.#previousCursors = d3.local();
    }

    destroy()
    {
    }

    #cursorSize(cursor) {
        const normalSize = cursor.inside || cursor.held;
        return (normalSize ? 15 : 12) * this.#scale;
    }

    #resizeMembers() {
        const _this=this; //See also: https://riptutorial.com/d3-js/example/27637/using--this--with-an-arrow-function
        _this.#cursorOverlay.selectAll("g")
            .attr("transform", CollabLayer.transformFunction(function() {
                return {scale: _this.#cursorSize(_this.#previousCursors.get(this))};
            }));
    }


    #enterMember(enter) {
        enter.append("g")
            .attr("transform", d => {
                const coords = coordinateHelper.viewportToOverlay(d.cursor);
                return `translate(${coords.x}, ${coords.y}), rotate(-30), scale(${this.#cursorSize(d.cursor)})`
            })
            .attr("opacity", 0.0)
            .style("fill", d => d.color)
            .call(group =>
                group.append("path")
                    .attr("d", "M 0 0 L -0.4 1.0 L 0 0.7 L 0.4 1.0 Z")
                    .attr("class", "pointer")
            )
            .call(group =>
                group.append("path")
                    .attr("d", "M -0.4 1.0 L -0.36 1.2 L 0.36 1.2 L 0.4 1.0 L 0 0.7 Z")
                    .attr("class", "caret")
                    .transition("appear").duration(500)
                    .attr("transform", "translate(0, 0.15)")
            )
            .transition("appear").duration(100)
            .attr("opacity", 1.0);
    }

    #updateMember(update) {
        const _this=this;
        update.attr("transform", CollabLayer.transformFunction(function(d) {
                const coords = coordinateHelper.viewportToOverlay(d.cursor);
                return {translate: [coords.x, coords.y]};
            }))
            .call(group =>
                group.filter(function(d) {return _this.#previousCursors.get(this).inside !== d.cursor.inside;})
                    .transition("changeColor").duration(500)
                    .style("opacity", d => d.cursor.inside ? 1.0 : 0.2)
            )
            .select(".caret")
            .filter(function(d) {
                return _this.#previousCursors.get(this).held !== d.cursor.held;
            })
            .transition("highlight").duration(150)
            .attr("transform", d => `translate(0, ${d.cursor.held ? 0.05 : 0.15})`);
    }

    /**
     * Use d3 to update the collaboration cursors, adding new ones and
     * removing old ones.
     * @param {Array} nonLocalMembers An array of members, excluding the
     * local member.
     */
    updateMembers(nonLocalMembers) {
        const visibleMembers = nonLocalMembers.filter(member => member.cursor);
        
        this.#cursorOverlay.selectAll("g")
            .data(visibleMembers, d => d.id)
            .join(
                enter => this.#enterMember(enter),
                update => this.#updateMember(update)
            );

        this.#cursorOverlay.selectAll("g")
            .property(this.#previousCursors, d => d.cursor);
    }

    /**
     * Let the overlay handler know the current zoom level and maximum
     * zoom level of the viewer in order to properly scale elements.
     * @param {number} zoomLevel The current zoom level of the OSD viewport.
     * @param {number} wContainer The maximum zoom level of the OSD viewport.
     */
    setZoom(zoomLevel, maxZoom, wContainer) {
        const windowSizeAdjustment = 1400 / wContainer; //1000*sqrt(2)?
        this.#scale = windowSizeAdjustment / zoomLevel;
        this.#resizeMembers();
    }


    setZ(level) {
        //Do nothing, since sharing overlay with regions
    }

    /**
     * Called when layer is lowered away from top
     */
    blur() {
        //Do nothing
    }

    /**
     * Called when layer is raised to top
     */
    focus() {
        //Do nothing
    }
}
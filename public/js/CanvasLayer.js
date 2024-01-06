"use strict";
/**
 * Class for misc drawing overlay.
 **/

class CanvasLayer extends OverlayLayer {

    constructor(name,canvasOverlay) {
        super(name,canvasOverlay._viewer,canvasOverlay._canvasdiv);
    }


    /**
     * Called when layer is lowered away from top
     */
    blur() {
    }

    /**
     * Called when layer is raised to top
     */
    focus() {
    }
}
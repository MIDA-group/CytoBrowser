"use strict";
/**
 * Class for misc drawing overlay.
 **/

class PaintLayer extends OverlayLayer {

    constructor(name,fabricjsOverlay) {
        super(name,fabricjsOverlay._viewer,fabricjsOverlay._canvasdiv);
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
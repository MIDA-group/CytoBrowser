"use strict";
/**
 * Class for misc drawing overlay.
 **/

class PaintLayer extends OverlayLayer {

//    #viewer = null; //OSD viewer
    #element = null; //DOM element 

    constructor(name,fabricjsOverlay) {
        super(name);

    //    this.#viewer=fabricjsOverlay._viewer;
        this.#element=fabricjsOverlay._canvasdiv;
    }

    setZ(level) {
        super.setZ(level);
        this.#element.style.zIndex=level; 
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
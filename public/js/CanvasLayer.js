"use strict";
/**
 * Class for misc drawing overlay.
 **/

class CanvasLayer extends OverlayLayer {
    #overlayObject = null; //For destroy
    #canvas;
    #texture; //Can be used for several sprites
    
    constructor(name,pixiOverlay) {
        super(name,pixiOverlay._viewer,pixiOverlay._pixi);
        this.overlayObject=pixiOverlay;
        
        //Drawing canvas
        this.#canvas = document.createElement('canvas');
        this.#canvas.height = 1000; //arb. resolution
        this.#canvas.width = 1000;
        
        //Pixi texture and sprite
        this.#texture = PIXI.Texture.from(this.#canvas);
        
        const sprite = new PIXI.Sprite(this.#texture);
        sprite.height = 1000; //Overlay coordinates
        sprite.width = 1000;

        pixiOverlay.stage().addChild(sprite);
        
        /**
         * Call this to show changes on screen
         */
        CanvasLayer.prototype.update = () => { //prototype, otherwise super doesn't work
            this.#texture.update();
            pixiOverlay.update();
        }
    }

    destroy(destroyOverlay = false) {
        if (destroyOverlay && this.overlayObject) {
            this.overlayObject.destroy();
            this.overlayObject=null;
        }
    }

    get texture() { return this.#texture; }

    getContext(...args) {
        return this.#canvas.getContext(...args);
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
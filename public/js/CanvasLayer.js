"use strict";
/**
 * Class for misc drawing overlay.
 **/

class CanvasLayer extends OverlayLayer {
    #canvas;
    #drawUpdate;

    constructor(name,pixiOverlay) {
        super(name,pixiOverlay._viewer,pixiOverlay._pixi);

        //Drawing canvas
        this.#canvas = document.createElement('canvas');
        this.#canvas.height = 1000; //arb. resolution
        this.#canvas.width = 1000;
        
        //Pixi texture and sprite
        const texture = PIXI.Texture.from(this.#canvas);
        const sprite = new PIXI.Sprite(texture);
        sprite.height = 1000; //Overlay coordinates
        sprite.width = 1000;

        pixiOverlay._app.stage.addChild(sprite);
        
        this.#drawUpdate=() => {
            texture.update();
            pixiOverlay.update();
        }
    }

    getContext(...args) {
        return this.#canvas.getContext(...args);
    }

    /**
     * Call after drawing
     */
    update() {
        this.#drawUpdate();
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
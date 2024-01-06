"use strict";
/**
 * Class for misc drawing overlay.
 **/

class CanvasLayer extends OverlayLayer {
    #stage;
    #container;
    #drawUpdate;

    constructor(name,pixiOverlay) {
        super(name,pixiOverlay._viewer,pixiOverlay._pixi);
        
        this.#stage=pixiOverlay._app.stage;

        //this.#drawUpdate=pixiOverlay.update; // Call this function when drawing anything, see pixi-overlay
        this.#drawUpdate=() => pixiOverlay.update(); // Aaargh, the 'this' functionality in JS is just... sigh!

        
        // Pixi container for rendering
        this.#container = new PIXI.Container();
        this.#stage.addChild(this.#container);
    
        const texture = PIXI.Texture.from('https://pixijs.com/assets/bunny.png');
        const bunny = new PIXI.Sprite(texture);
        this.#container.addChild(bunny);
        
        //In overlay coords
        bunny.height = 1000;
        bunny.width = 1000;
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
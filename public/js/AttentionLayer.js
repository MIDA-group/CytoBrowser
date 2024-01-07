"use strict";
/**
 * Overlay class for visualizing attention.
 **/

class AttentionLayer extends CanvasLayer {
    #tracking=null; //on/off

    constructor(name,pixiOverlay) {
        super(name,pixiOverlay);
        
        $("#attention_track_switch").change((e) => {
            this.#tracking = e.target.checked;
        });

        this._viewer.addHandler('update-viewport', (event) => {
            if (this.#tracking == null) {
                this.#tracking = document.getElementById("attention_track_switch")?.checked; //jQuery fails!
            }
            this.#tracking && this.#storeViewport();
            //console.log('Tracking: ',this.#tracking);
        });

        this.style.visibility = document.getElementById("attention_view_switch").checked? "visible":"hidden";
        $("#attention_view_switch").change((e) => {
            this.style.visibility=e.target.checked? "visible":"hidden";
        });

        //Copy for navigator
        const navigatorOverlay = this._viewer.pixiOverlay(this._viewer.navigator.canvas,{viewer:this._viewer.navigator});
        const sprite = new PIXI.Sprite(this.texture);
        sprite.height = 1000; //Overlay coordinates
        sprite.width = 1000;
        navigatorOverlay.stage().addChild(sprite);
        
        /**
         * Call this to show changes on screen
         */
        AttentionLayer.prototype.update = () => {
            super.update();
            navigatorOverlay.update();
        }

    } 

    #paintViewport(ul,dr,opacity) {
        // Paint rectangle
        const w=dr.x-ul.x;
        const h=dr.y-ul.y;
        
        const ctx = this.getContext("2d");
        ctx.fillStyle = `rgba(0, 200, 0, ${opacity})`;
        //Skip 10% close to edge
        ctx.fillRect(ul.x+0.1*w, ul.y+0.1*h, 0.8*w, 0.8*h);
        this.update();
        
        console.log('Opacity: ',opacity);
    }

    #start=null;
    #oldUl={};
    #oldDr={};
    //Modelled after MarkerLayers.cullMarkers()
    #storeViewport() {
        //Area in pixels, from overlay coords
        const pixArea = (ul,dr) => {
            const uli=coordinateHelper.overlayToImage(ul);
            const dri=coordinateHelper.overlayToImage(dr);
            return (dri.x-uli.x)*(dri.y-uli.y);
        }

        if (!coordinateHelper.hasImage()) return;
        const ul=coordinateHelper.webToOverlay({x:0,y:0});
        const dr=coordinateHelper.webToOverlay(this._viewer.viewport._containerInnerSize);
        //Check if the view actually changed
        if (!this.#start || ul.x!=this.#oldUl.x || ul.y!=this.#oldUl.y || dr.x!=this.#oldDr.x || dr.y!=this.#oldDr.y) {
            const stop = Date.now();
            let viewPause =  (stop - this.#start)/1000; //In seconds
            viewPause = Math.min(60,viewPause); //No more than 60s staring at the same spot
            const area = pixArea(this.#oldUl,this.#oldDr)/1_000_000; //Mpx
            console.log('Visible area [Mpx]: ',area.toPrecision(2));
            const opacity = 0.2*Math.sqrt(viewPause) / Math.pow(area,1.5);
            if (opacity > 0.01) {
                this.#paintViewport(this.#oldUl,this.#oldDr,opacity);
            }
            this.#start=stop;
            this.#oldUl=ul;
            this.#oldDr=dr;
        }
    }

}
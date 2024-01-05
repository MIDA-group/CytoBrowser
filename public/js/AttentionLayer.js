"use strict";
/**
 * Overlay class for visualizing attention.
 **/

class AttentionLayer extends PaintLayer {
    #tracking=null; //on/off
    #fabricCanvas;
    #navigatorCanvas;
    
    constructor(name,fabricjsOverlay) {
        super(name,fabricjsOverlay);
        
        //Where to paint
        this.#fabricCanvas=fabricjsOverlay.fabricCanvas();

        $("#attention_track_switch").change((e) => {
            this.#tracking = e.target.checked;
        });

        this._viewer.addHandler('update-viewport', (event) => {
            if (this.#tracking == null) {
                this.#tracking = document.getElementById("attention_track_switch")?.checked; //jQuery fails!
            }
            this.#tracking && this.#storeViewport();
            console.log('Tracking: ',this.#tracking);
        });

        this.style.visibility = document.getElementById("attention_view_switch").checked? "visible":"hidden";
        $("#attention_view_switch").change((e) => {
            this.style.visibility=e.target.checked? "visible":"hidden";
        });

        //One copy for the navigator as well
        const navigatorOverlay = this._viewer.fabricjsOverlay({scale: 1000, viewer: this._viewer.navigator, static: true});
        this.#navigatorCanvas = navigatorOverlay.fabricCanvas();
    } 

    //Skip 10% close to edge
    #paintViewport(ul,dr,opacity) {
        // Add fabric rectangle
        const w=dr.x-ul.x;
        const h=dr.y-ul.y;
        var rect = new fabric.Rect({
            left: ul.x+0.1*w,
            top: ul.y+0.1*h,
            fill: 'green',
            width: 0.8*w,
            height: 0.8*h,
            opacity: opacity
        });
        this.#fabricCanvas.add(rect);
        this.#navigatorCanvas.add(rect);

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
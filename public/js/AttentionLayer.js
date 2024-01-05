"use strict";
/**
 * Overlay class for visualizing attention.
 **/

class AttentionLayer extends PaintLayer {
    #fabricCanvas;
    #navigatorCanvas;
    
    constructor(name,fabricjsOverlay) {
        super(name,fabricjsOverlay);
        
        //Where to paint
        this.#fabricCanvas=fabricjsOverlay.fabricCanvas();

        this._viewer.addHandler('update-viewport', (event) => {
            this.#storeViewport();
        });

        this.style.visibility = $("#attention_view_switch").checked? "visible":"hidden";
        $("#attention_view_switch").change((e) => {
            this.style.visibility=e.target.checked? "visible":"hidden";
        });

        //One copy for the navigator as well
        const navigatorOverlay = this._viewer.fabricjsOverlay({scale: 1000, viewer: this._viewer.navigator, static: true});
        this.#navigatorCanvas = navigatorOverlay.fabricCanvas();
    } 

    #paintViewport(ul,dr,opacity) {
        // Add fabric rectangle
        var rect = new fabric.Rect({
            left: ul.x,
            top: ul.y,
            fill: 'green',
            width: dr.x-ul.x,
            height: dr.y-ul.y,
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

        const ul=coordinateHelper.webToOverlay({x:0,y:0});
        const dr=coordinateHelper.webToOverlay(this._viewer.viewport._containerInnerSize);
        //Check if the view actually changed
        if (!this.#start || ul.x!=this.#oldUl.x || ul.y!=this.#oldUl.y || dr.x!=this.#oldDr.x || dr.y!=this.#oldDr.y) {
            const stop = Date.now();
            let viewPause =  (stop - this.#start)/1000; //In seconds
            viewPause = Math.min(60,viewPause); //No more than 60s staring at the same spot
            const area = pixArea(this.#oldUl,this.#oldDr)/1_000_000; //Mpx
            console.log('Visible area [Mpx]: ',area.toPrecision(1));
            const opacity = 0.5*viewPause / area;
            if (opacity > 0.01) {
                this.#paintViewport(this.#oldUl,this.#oldDr,opacity);
            }
            this.#start=stop;
            this.#oldUl=ul;
            this.#oldDr=dr;
        }
    }

}
"use strict";
/**
 * Overlay class for visualizing attention.
 **/

class AttentionLayer extends PaintLayer {
    #fabricCanvas;
    
    constructor(name,fabricjsOverlay) {
        super(name,fabricjsOverlay);

        this.#fabricCanvas=fabricjsOverlay.fabricCanvas();


        this._viewer.addHandler('update-viewport', (event) => {
            this.#storeViewport();
        });
    } 

    #paintViewport(ul,dr,opacity) {
        // Add fabric rectangle
        var rect = new fabric.Rect({
            left: ul.x,
            top: ul.y,
            fill: 'red',
            width: dr.x-ul.x,
            height: dr.y-ul.y,
            opacity: opacity
        });
        this.#fabricCanvas.add(rect);
    
        console.log('Opacity: ',opacity);
    }

    #start=null;
    #oldUl={};
    #oldDr={};
    //Modelled after MarkerLayers.cullMarkers()
    #storeViewport() {
        const ul=coordinateHelper.webToOverlay({x:0,y:0});
        const dr=coordinateHelper.webToOverlay(this._viewer.viewport._containerInnerSize);
        //Check if the view actually changed
        if (!this.#start || ul.x!=this.#oldUl.x || ul.y!=this.#oldUl.y || dr.x!=this.#oldDr.x || dr.y!=this.#oldDr.y) {
            const stop = Date.now();
            let viewPause =  (stop - this.#start)/1000; //In seconds
            viewPause = Math.min(60,viewPause); //No more than 60s staring
            const opacity = viewPause/10 * this.#zoomRatio;
            if (opacity > 0.01) {
                this.#paintViewport(this.#oldUl,this.#oldDr,opacity);
            }
            this.#start=stop;
            this.#oldUl=ul;
            this.#oldDr=dr;
        }
    }

    #zoomRatio=1;
    setZoom(zoomLevel, maxZoom, wContainer) {
        console.log(`Zoom: ${zoomLevel}/${maxZoom}`);
        this.#zoomRatio=zoomLevel/maxZoom;
    }
}
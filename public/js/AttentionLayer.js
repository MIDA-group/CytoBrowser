"use strict";
/**
 * Overlay class for visualizing attention.
 **/

class AttentionLayer extends PaintLayer {
    constructor(name,fabricjsOverlay) {
        super(name,fabricjsOverlay);
    
        this._viewer.addHandler('update-viewport', (event) => {
            let ul=coordinateHelper.webToOverlay({x:0,y:0});
            let lr=coordinateHelper.webToOverlay(this._viewer.viewport._containerInnerSize);
            
            // Add fabric rectangle
            var rect = new fabric.Rect({
                left: ul.x,
                top: ul.y,
                fill: 'red',
                width: lr.x-ul.x,
                height: lr.y-ul.y,
                opacity: 0.01
            });
            fabricjsOverlay.fabricCanvas().add(rect);

        });
    } 
}
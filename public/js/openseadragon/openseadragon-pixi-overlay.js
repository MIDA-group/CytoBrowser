// OpenSeadragon Pixi Overlay plugin 0.0.1 (derived from SVG Overlay 0.0.5)

(function() {

    var $ = window.OpenSeadragon;

    if (!$) {
        $ = require('openseadragon');
        if (!$) {
            throw new Error('OpenSeadragon is missing.');
        }
    }

    // ----------
    $.Viewer.prototype.pixiOverlay = function(container=this.canvas,options) {
        /*if (this._pixiOverlayInfo) {
            return this._pixiOverlayInfo;
        }*/

        this._pixiOverlayInfo = new Overlay(options?.viewer ?? this, container);
        return this._pixiOverlayInfo;
    };

    // Turn off TouchEvents to prevent them propagating, see also https://github.com/pixijs/pixijs/issues/8037
    function turnOffTouchEvents(interactionManager) {
        interactionManager.interactionDOMElement.removeEventListener('touchstart', interactionManager.onPointerDown, true);
        interactionManager.interactionDOMElement.removeEventListener('touchcancel', interactionManager.onPointerCancel, true);
        interactionManager.interactionDOMElement.removeEventListener('touchend', interactionManager.onPointerUp, true);
        interactionManager.interactionDOMElement.removeEventListener('touchmove', interactionManager.onPointerMove, true);
        interactionManager.supportsTouchEvents = false;
    }     
      
    // ----------
    // Option to use other container than viewer.canvas, e.g. for internal z-stacking
    var Overlay = function(viewer, container=viewer.canvas) {
        console.log(viewer);
        var self = this;

        this._viewer = viewer;
        this._containerWidth = 0;
        this._containerHeight = 0;

        this._pixi = document.createElement('pixiOverlay');
        this._pixi.style.position = 'absolute';
        this._pixi.style.left = 0;
        this._pixi.style.top = 0;
        this._pixi.style.width = '100%';
        this._pixi.style.height = '100%';
        container.appendChild(this._pixi);

        // Create the application helper and add its render target to the page
        this._app = new PIXI.Application({
            //resizeTo: this._pixi,
            transparent: true,
            antialias: true,
            sharedTicker: true
        });
        this._app.ticker.maxFPS = 30; // To reduce environmental impact
        this._app.renderer.plugins.interaction.moveWhenInside = true;
        this._app.renderer.plugins.interaction.autoPreventDefault=true;
        turnOffTouchEvents(this._app.renderer.plugins.interaction);

        this._pixi.appendChild(this._app.view);
        
        this._viewer.addHandler('animation', () => {
            self.resize();
        });

        this._viewer.addHandler('open',  () => {
            self.resize();
        });

        this._viewer.addHandler('rotate',  () => {
            self.resize();
        });

        this._viewer.addHandler('resize',  () => {
            self.resize();
        });

        this._viewer.addHandler('update-viewport', () => {
            self.update();
        });

        this.resize();
    };

    const _tickerTime = 5 * 1000; // Run ticker for 5 seconds on updates
    let _tickerTimeout = 0;
    let _lastUpdateTime = performance.now();

    // ----------
    Overlay.prototype = {
        // ----------
        app: function() {
            return this._app;
        },
        stage: function() {
            return this._app.stage;  
        },
        update: function() { // Call this function whenever drawing, to allow animations to run _tickerTime 
            if (performance.now()-_lastUpdateTime < 0.1) { // Ignore is less than 0.1ms since last exectuted call
                return; // Avoid flooding
            }
            this._app.renderer.render(this._app.stage); // Call render directly to reduce lag
            _lastUpdateTime = performance.now();

            if (!this._app.ticker.started) {
                this._app.ticker.start(); // Start render loop
                console.log('Ticker started');
            }
            if (_tickerTimeout) {
                clearTimeout(_tickerTimeout);
            }
            _tickerTimeout = setTimeout(() => {
                this._app.ticker.stop();
                _tickerTimeout = 0;
                console.log('Ticker paused');
            }, _tickerTime); // Pause render loop after a while
        },

        // ----------
        resize: function() {
            let changed_size=false; 
            if (this._containerWidth !== this._viewer.container.clientWidth) {
                this._containerWidth = this._viewer.container.clientWidth;
                this._pixi.setAttribute('width', this._containerWidth);
                changed_size=true;
            }

            if (this._containerHeight !== this._viewer.container.clientHeight) {
                this._containerHeight = this._viewer.container.clientHeight;
                this._pixi.setAttribute('height', this._containerHeight);
                changed_size=true;
            }

            if (changed_size) {
                this._app.renderer.resize(this._containerWidth, this._containerHeight);
                console.log(`pixiOverlay resize: ${this._containerWidth},${this._containerHeight}`);
            }


            const p = this._viewer.viewport.viewportToViewerElementCoordinates(new $.Point(0, 0), true);
            const zoom = this._viewer.viewport.getZoom(true);
            const rotation = Math.PI/180*this._viewer.viewport.getRotation();
            // TODO: Expose an accessor for _containerInnerSize in the OSD API so we don't have to use the private variable.
            const scale = this._viewer.viewport._containerInnerSize.x * zoom;
            
            this._app.stage.scale.set(scale/1000);
            this._app.stage.position.set(p.x,p.y);
            this._app.stage.rotation=rotation;

        // Draw a red frame around the overlay
/*         {
            const graphics = new PIXI.Graphics();
            graphics.lineStyle(1, 0xFF0000);
            graphics.drawRect(0,0,1000,1000);
            this._app.stage.addChild(graphics);
        } */


//         // Listen for animate update
// this._app.ticker.add((delta) => {
//     // rotate the container!
//     // use delta to create frame-independent transform
//     this._app.stage.rotation -= 0.001 * delta;
// });
            this.update();
        },

        // ----------
        // onClick: function(node, handler) {
        //     // TODO: Fast click for mobile browsers

        //     new $.MouseTracker({
        //         element: node,
        //         clickHandler: handler
        //     }).setTracking(true);
        // }
    };

})();

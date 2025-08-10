// OpenSeadragon Pixi Overlay plugin 0.0.1 (derived from SVG Overlay 0.0.5)

(function() {

    var $ = window.OpenSeadragon;

    if (!$) {
        $ = require('openseadragon');
        if (!$) {
            throw new Error('OpenSeadragon is missing.');
        }
    }

    /**
     * Adds pixi.js overlay capability to your OpenSeadragon Viewer
     *
     * @param {Object} options
     *     Allows configurable properties to be entirely specified by passing
     *     an options object to the constructor.
     *
     * @param {Object} options.container
     *     Container element to use, instead of Viewer.canvas
     * 
     * @param {Object} options.viewer
     *     Use other viewer than 'this'
     * 
     * @returns {Overlay}
     */
    $.Viewer.prototype.pixiOverlay = function(options) {
        try {
            this._pixiOverlayInfo = new Overlay(options?.viewer ?? this, options?.container);
            this._pixiOverlayInfo.ready.catch(console.error);
            return this._pixiOverlayInfo;
        } catch(e) {
            console.error(e);
        }
    };

    // ----------
    // Option to use other container than viewer.canvas, e.g. for internal z-stacking
    var Overlay = function(viewer, container=viewer.canvas) {
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
        
        this.ready = this.init();

        // Create the application helper and add its render target to the page
        // TODO: This will lead to running out of WebGL context, better to use separate logics, 
        //  see https://github.com/pixijs/pixijs/wiki/v5-Custom-Application-GameLoop
    }

    const _tickerTime = 5 * 1000; // Run ticker for 5 seconds on updates
    let _tickerTimeout = 0;
    let _requestedAnimationFrame = false;

    // ----------
    Overlay.prototype = {
        init: async function() {
            var self = this;
            try {
                this._app = new PIXI.Application();
                await this._app.init({
                    antialias: true,
                    backgroundAlpha: 0,
                    culler: false,
                    eventFeatures: {
                        move: true,
                        click: true,
                        wheel: false,
                        globalMove: false
                    },
                    eventMode: 'static',
                    preference: 'webgl',
                    sharedTicker: true,
                    preserveDrawingBuffer: false
                });

                this._app.ticker.maxFPS = 30; // To reduce environmental impact
                this._app.renderer.events.preventDefault = true;
                this._app.renderer.events.supportsTouchEvents = false;
                this._app.stage.interactive = false;

                this._pixi.appendChild(this._app.canvas);

                // Check if WebGL is supported
                if (!PIXI.isWebGLSupported()) {
                    console.error("WebGL is not supported. Suggested to switch to Chrome browser.");
                    alert("WebGL initialization failed. Please check your browser settings.");
                }
            } catch (error) {
                console.error("Pixi.js failed to initialize:", error, error?.stack);
                alert(`Graphics initialization failed: ${error?.message || 'Please check your browser settings (unknown error)'}`);
            }

            //TODO: removeHandler functionality
            this._viewer.addHandler('animation', () => {
                self.resize();
                self.update();
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
        },
        // ----------
        destroy: function() {
            //console.log('Destroying Pixi app');
            this._app.destroy({ children: true, texture: true, baseTexture: true });
            this._app=null;
        },
        app: function() {
            return this._app;
        },
        stage: function() {
            return this._app.stage;  
        },
        update: function() { // Call this function whenever drawing, to allow animations to run _tickerTime 
            if (!this.app()) return; // Destroyed (instead of running through removeHandler)
            if (_requestedAnimationFrame) return; // Already scheduled

            _requestedAnimationFrame = true;
            this._app.renderer.render(this._app.stage); // Call render directly to reduce lag

            // Call requestAnimationFrame to block further renders until the next frame
            requestAnimationFrame(() =>{
                _requestedAnimationFrame = false;
            });

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
            if (!this.app()) return; // Destroyed (instead of running through removeHandler)
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
                //console.log(`pixiOverlay resize: ${this._containerWidth},${this._containerHeight}`);
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

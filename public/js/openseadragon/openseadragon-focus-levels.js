/**
 * Small plugin used for handling the focus adjustment in OpenSeadragon.
 * Moved to here in order to keep the other code a bit simpler, and could
 * potentially also be used in other projects that require focus adjustment
 * in OSD. The plugin extends the Viewer class by adding the function
 * openFocusLevels(), which sets an array of images up as focus levels
 * that can be swapped between using setFocusLevel(), decrementFocus(),
 * and incrementFocus().
 */
(function($) {
    "use strict";

    // Ensure OSD exists
    if (!$) {
        $ = require("openseadragon");
        if (!$) {
            throw new Error("OpenSeadragon is missing.");
        }
    }

    /**
     * Utility function for getting the best load order of slides for a
     * given focus level. The order will be the one that first loads the
     * current focus level, followed by the focus level closest to the
     * current level. The function favors higher focus levels, such that
     * _getLoadOrder(5, 2) will give [2, 3, 1, 4, 0].
     * @param {number} n The number of focus levels.
     * @param {number} z The current focus level.
     * @returns {Array<number>} The ideal order in which to load focus levels.
     */
    function _getLoadOrder(n, z) {
        const order = [z];
        for (let d = 1; d < n; d++) {
            if (z + d < n) {
                order.push(z + d);
            }
            if (z - d >= 0) {
                order.push(z - d);
            }
        }
        return order;
    }

    /**
     * Open a series of images that together form a stack of the same
     * subject at different focus levels. This function prepares the
     * images in such a way that the focus level can be changed, with
     * this being implemented through a change in opacity.
     * @param {Array<>} tileSources An array of tile sources for the
     * images that represent the different focus levels of the subject.
     * @param {number} [initialZ] The z level that should be set as the
     * initial focus level in the OSD viewer. If not set, it will
     * automatically be set to the first z level.
     * @param {Array<number>} [zLevels] The z levels that the array of
     * tile sources correspond to, which are used as values when setting
     * the focus later on. If not set, it will automatically be set to
     * represent the indices of the tile sources.
     */
    $.Viewer.prototype.openFocusLevels = function(tileSources, initialZ, zLevels) {
        // TODO: Not used in CyBr, but what to do about OSD sequence mode?

        if (!Array.isArray(tileSources)) {
            tileSources = [tileSources];
        }
        const nLevels = tileSources.length;

        // Set the focus levels if none have been set
        if (zLevels) {
            if (!Array.isArray(zLevels)) {
                throw new Error("The z levels should be an array.");
            }
            if (zLevels.length !== tileSources.length) {
                throw new Error("The number of z levels should be the same as the number of tile sources.");
            }
        }
        else {
            zLevels = Array.from({length: nLevels}, (x, i) => i);
        }

        // Set an initial focus level if none has been set
        if (typeof initialZ !== "number" || !(initialZ in zLevels)) {
            console.warn("Invalid initial focus level, setting to first.");
            initialZ = zLevels[0];
        }

        // Set appropriate opacities for all tile sources
        const tileSourcesWithOpacity = tileSources.map((tileSource, i) => {
            if (typeof tileSource === "string") {
                return {
                    tileSource: tileSource,
                    opacity: zLevels[i] === initialZ ? 1 : 0
                };
            }
            else if (typeof tileSource === "object") {
                tileSource.opacity = zLevels[i] === initialZ ? 1 : 0;
                return tileSource;
            }
        });

        // Reorder the tile sources
        const initialZIndex = zLevels.findIndex(z => z === initialZ);
        const order = _getLoadOrder(nLevels, initialZIndex);
        const orderedTileSources = order.map(i => {
            return tileSourcesWithOpacity[i];
        });

        this._hasFocusLevels = true;
        this._currentLoadOrder = order;
        this._nFocusLevels = nLevels;
        this._currentZ = initialZ;
        this._zLevels = zLevels;
        orderedTileSources.forEach(tileSource => {
            Object.assign(tileSource, {
                success: () => {
                    if (this.world.getItemCount() === nLevels) {
                        this.raiseEvent("open");
                    }
                },
                error: () => this.raiseEvent("open-failed")
            });
            this.addTiledImage(tileSource);
        });
    }

    /**
     * Set the focus level of the of the OSD viewer, assuming the images
     * were opened using openFocusLevels().
     * @param {number} z The new focus level. The value used should
     * correspond to the value specified in the zLevels argument of
     * openFocusLevels().
     */
    $.Viewer.prototype.setFocusLevel = function(z) {
        const oldZ = this._currentZ;
        const newZ = z;
        const oldZIndex = this._zLevels.findIndex(z => oldZ === z);
        const newZIndex = this._zLevels.findIndex(z => newZ === z);
        const nItems = this._nFocusLevels;

        if (!this._hasFocusLevels) {
            throw new Error("Cannot set focus level if tiles were not initialized as focus levels.");
        }

        if (newZIndex < 0 || newZIndex >= nItems) {
            throw new Error("Cannot set a focus level outside the range of focus levels.");
        }

        if (oldZ !== newZ) {
            // Rearrange the load order of the items
            const oldOrder = this._currentLoadOrder;
            const newOrder = _getLoadOrder(nItems, newZIndex);
            const unorderedItems = new Array(nItems);
            oldOrder.forEach((z, i) => unorderedItems[z] = this.world._items[i]);
            this.world._items.length = 0;
            newOrder.forEach(z => this.world._items.push(unorderedItems[z]));

            // Adjust the opacities
            unorderedItems[newZIndex].setOpacity(1);
            unorderedItems[oldZIndex].setOpacity(0);

            // Set the current order for the next focus level change
            this._currentLoadOrder = newOrder;
            this._currentZ = newZ;
        }
    }

    /**
     * Increment the focus level of the viewer if possible.
     * @returns {number} The new focus level.
     */
    $.Viewer.prototype.incrementFocus = function() {
        const nItems = this._nFocusLevels;
        const oldZ = this._currentZ;
        const oldZIndex = this._zLevels.findIndex(z => oldZ === z);
        if (oldZIndex < nItems - 1) {
            const newZIndex = oldZIndex + 1;
            const newZ = this._zLevels[newZIndex];
            this.setFocusLevel(newZ);
            return newZ;
        }
        else {
            return oldZ;
        }
    }

    /**
     * Decrement the focus level of the viewer if possible.
     * @returns {number} The new focus level.
     */
    $.Viewer.prototype.decrementFocus = function() {
        const oldZ = this._currentZ;
        const oldZIndex = this._zLevels.findIndex(z => oldZ === z);
        if (oldZIndex > 0) {
            const newZIndex = oldZIndex - 1;
            const newZ = this._zLevels[newZIndex];
            this.setFocusLevel(newZ);
            return newZ;
        }
        else {
            return oldZ;
        }
    }

    // Wrapper of the draw function to force current focus level first
    $.TiledImage.prototype._unalteredDraw = $.TiledImage.prototype.draw;
    $.TiledImage.prototype.draw = function() {
        const viewer = this.viewer;
        if (viewer._hasFocusLevels) {
            const index = viewer.world.getIndexOfItem(this);
            if (index === 0) {
                this._unalteredDraw();
            }
            else {
                const previousTile = viewer.world.getItemAt(index - 1);
                if (previousTile.getFullyLoaded()) {
                    this._unalteredDraw();
                }
                else {
                    previousTile.addOnceHandler("fully-loaded-change", e => {
                        this.draw();
                    });
                }
            }
        }
        else {
            this._unalteredDraw();
        }
    }
})(OpenSeadragon);

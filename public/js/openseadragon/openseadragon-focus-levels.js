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
     * TODO
     */
    $.Viewer.prototype.openFocusLevels = function(tileSources, initialZ) {
        // TODO: What to do about OSD sequence mode?

        if (!Array.isArray(tileSources)) {
            tileSources = [tileSources];
        }
        const nLevels = tileSources.length;

        // Set an initial focus level if none has been set
        if (initialZ !== "number" || initialZ < 0) {
            console.warn("Invalid initial focus level, setting to 0.");
            initialZ = 0;
        }
        else if (initialZ >= nLevels) {
            console.warn("Invalid initial focus level, setting to max.");
            initialZ = nLevels - 1;
        }

        // Set appropriate opacities for all tile sources
        const tileSourcesWithOpacity = tileSources.map((tileSource, z) => {
            if (typeof tileSource === "string") {
                return {
                    tileSource: tileSource,
                    opacity: z === initialZ ? 1 : 0
                };
            }
            else if (typeof tileSource === "object") {
                tileSource.opacity = z === initialZ ? 1 : 0;
                return tileSource;
            }
        });

        // Reorder the tile sources
        const order = _getLoadOrder(nLevels, initialZ);
        const orderedTileSources = order.map(z => {
            return tileSourcesWithOpacity[z];
        });

        this._hasFocusLevels = true;
        this._currentLoadOrder = order;
        this._nFocusLevels = nLevels;
        this._currentZ = initialZ;
        this.open(orderedTileSources);
    }

    /**
     * TODO
     */
    $.Viewer.prototype.setFocusLevel = function(z) {
        const oldZ = this._currentZ;
        const newZ = z;
        const nItems = this.world._items.length;

        if (!this._hasFocusLevels) {
            throw new Error("Cannot set focus level if tiles were not initialized as focus levels.");
        }

        if (z < 0 || z >= nItems) {
            throw new Error("Cannot set a focus level outside the range of focus levels.");
        }

        if (oldZ !== newZ) {
            // Rearrange the load order of the items
            const oldOrder = this._currentLoadOrder;
            const newOrder = _getLoadOrder(n, newZ);
            const unorderedItems = new Array(nItems);
            oldOrder.forEach((z, i) => unorderedItems[z] = this.world._items[i]);
            this.world._items.length = 0;
            newOrder.forEach(z => this.world._items.push(unorderedItems[z]));

            // Adjust the opacities
            unorderedItems[newZ].setOpacity(1);
            unorderedItems[oldZ].setOpacity(0);

            // Set the current order for the next focus level change
            this._currentLoadOrder = newOrder;
        }
    }
})(OpenSeadragon);

/**
 * Namespace for handling the region editing functionality, intended to
 * make it easier to turn it on and off from other parts of the code.
 * While overlayHandler has public functions for enabling and disabling
 * editing controls for regions, these are only intended for this
 * namespace, as this namespace is also used to make sure that only one
 * region is being edited at a time.
 *
 * @namespace regionEditor
 */

const regionEditor = (function() {
    let _currentlyEditedRegionId = null;

    /**
     * Stop editing any region that is currently being edited and begin
     * editing a given region.
     * @param {number} id The id of the annotation corresponding to
     * the region.
     */
    function startEditingRegion(id) {
        stopEditingRegion();
        _currentlyEditedRegionId = id;
        overlayHandler.startRegionEdit(id);
    }

    /**
     * Stop editing the region currently being edited and remove its
     * handles, if a region is currently being edited.
     * @returns {boolean} Whether or not a region editing was stopped.
     */
    function stopEditingRegion() {
        if (_currentlyEditedRegionId !== null) {
            overlayHandler.stopRegionEdit(_currentlyEditedRegionId);
            _currentlyEditedRegionId = null;
            return true;
        }
        else {
            return false;
        }
    }

    /**
     * If a given region is currently being edited, stop editing it.
     * @param {number} id The id of the annotation corresponding to
     * the region.
     * @returns {boolean} Whether or not a region editing was stopped.
     */
    function stopEditingRegionIfBeingEdited(id) {
        if (_currentlyEditedRegionId === id) {
            return stopEditingRegion();
        }
        else {
            return false;
        }
    }

    return {
        startEditingRegion,
        stopEditingRegion,
        stopEditingRegionIfBeingEdited
    };
})();

/**
 * Namespace for handling any local visual representation of annotations.
 * @namespace annotationVisuals
 */
const annotationVisuals = (function() {
    "use strict";

    /**
     * Update the current visuals for the annotations.
     * @param {Array} annotations All currently placed annotations.
     */
    function update(annotations){
    	overlayHandler.updateAnnotations(annotations);
        tableHandler.updateAnnotations(annotations);
    }

    /**
     * Clear all annotations from the overlay. This function should
     * be called whenever annotations are to be quickly cleared and
     * readded, e.g. when loading annotations from a collab summary.
     * Since the annotation elements will remain until their animation
     * has finished when removing them, d3 will think that they
     * still exist when calling update() before calling this function.
     */
    function clear(){
    	overlayHandler.clearAnnotations();
    }

    return {
        update: update,
        clear: clear
    };
})();

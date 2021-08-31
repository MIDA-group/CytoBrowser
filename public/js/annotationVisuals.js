/**
 * Namespace for handling any local visual representation of annotations.
 * @namespace annotationVisuals
 */
const annotationVisuals = (function() {
    "use strict";

    let _annotationList = null;
    let _unfilteredAnnotations = [];
    let _filter = filters.getFilterFromQuery("");
    let _filterIsTrivial = true;

    function _filterAndUpdate() {
        const annotations = _unfilteredAnnotations.filter(annotation => {
            const filterableAnnotation = filters.preprocessDatumBeforeFiltering(annotation);
            return _filter.evaluate(filterableAnnotation);
        });
        overlayHandler.updateAnnotations(annotations);
        if (_annotationList) {
            _annotationList.updateData(annotations);
        }
        else {
            console.warn("No annotation list has been set.");
        }
        if (!_filterIsTrivial) {
            tmappUI.setFilterInfo(_unfilteredAnnotations.length, annotations.length);
        }
    }

    /**
     * Set the annotation list object that should be used to disply
     * information about the annotations. This should be set before
     * update is called.
     * @param {AnnotationList} annotationList The list to use.
     */
    function setAnnotationList(annotationList) {
        _annotationList = annotationList;
    }

    // TODO: Document
    function setFilterQuery(query) {
        try {
            const filter = filters.getFilterFromQuery(query);
            _filter = filter;
        }
        catch (e) {
            const error = e.message;
            tmappUI.setFilterError(error);
            return;
        }
        _filterIsTrivial = query.length === 0;
        _filterAndUpdate();
        if (_filterIsTrivial) {
            tmappUI.clearFilterInfo();
        }
    }

    /**
     * Update the current visuals for the annotations.
     * @param {Array} annotations All currently placed annotations.
     */
    function update(annotations){
        _unfilteredAnnotations = annotations;
        _filterAndUpdate();
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
    	// TODO: This function shouldn't have to exist, update() should be enough
    	overlayHandler.clearAnnotations();
    }


    return {
        update: update,
        setAnnotationList: setAnnotationList,
        setFilterQuery: setFilterQuery,
        clear: clear
    };
})();

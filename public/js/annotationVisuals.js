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
    let _lastQueryWasValid = true;

    /* This is the heavy work function: filter and visualize annotations */
    const pending_vis_count = (function () { let i = 0; return (val=0) => i+=val; })();
    const pending_list_count = (function () { let i = 0; return (val=0) => i+=val; })();
    function _filterAndUpdate() {
        console.time('visFiltUpd');

        const annotations = _unfilteredAnnotations.filter(annotation => {
            const filterableAnnotation = filters.preprocessAnnotationBeforeFiltering(annotation);
            return _filter.evaluate(filterableAnnotation);
        });

        //Draw annotations and update list asynchronously
        const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

        let this_vis_count=pending_vis_count(1); //add one
        console.log('Init overlay update: ',this_vis_count);
        wait(0) //Using Promise.resolve() didn't give time enough for rendering
            .then(() => {
                if (this_vis_count==pending_vis_count()) { //if we're the last one
                    console.log('running overlay update: ',this_vis_count);
                    overlayHandler.updateAnnotations(annotations);
                }
                else {
                    console.log('skipping overlay update',this_vis_count,pending_vis_count());
                }
            });

        let this_list_count=pending_list_count(1); //add one
        if (_annotationList) {
            console.log('Init list update: ',this_list_count);
            wait(0) 
                .then(() => {
                    if (this_list_count==pending_list_count()) { //if we're the last one
                        console.log('running list update: ',this_list_count);
                        _annotationList.updateData(annotations.slice().reverse()); // No sort -> reverse order
                    }
                    else {
                        console.log('skipping list update',this_list_count,pending_list_count());
                    }
                });
        }
        else {
            console.warn("No annotation list has been set.");
        }

        if (!_filterIsTrivial && _lastQueryWasValid) {
            tmappUI.setFilterInfo(_unfilteredAnnotations.length, annotations.length);
        }

        console.timeEnd('visFiltUpd');
    }

    function _setFilter(query) {
        try {
            const filter = filters.getFilterFromQuery(query);
            _filter = filter;
            _filterIsTrivial = query.length === 0;
            _lastQueryWasValid = true;
        }
        catch (e) {
            const error = e.message;
            tmappUI.setFilterError(error);
            _lastQueryWasValid = false;
        }
    }

    /**
     * Set the annotation list object that should be used to disply
     * information about the annotations. This should be set before
     * update is called.
     * @param {SortableList} annotationList The list to use.
     */
    function setAnnotationList(annotationList) {
        _annotationList = annotationList;
    }

    /**
     * Set the query that should be used to filter annotations in the
     * visuals.
     * @param {string} query The filter query to be used. Should have
     * the same format as in filters.getFilterFromQuery().
     */
    function setFilterQuery(query) {
        _setFilter(query);
        _filterAndUpdate();
        if (_filterIsTrivial && _lastQueryWasValid) {
            tmappUI.clearFilterInfo();
        }
    }

    /**
     * Set the filter query without attempting to update the visuals.
     * This can be called when the visuals are being initialized to
     * avoid trying to draw on an overlay that doesn't exist.
     * @param {string} query The filter query to be used. Should have
     * the same format as in filters.getFilterFromQuery().
     */
    function setFilterQueryWithoutUpdating(query) {
        _setFilter(query);
    }

    /**
     * Update the current visuals for the annotations.
     * @param {Array} annotations All currently placed annotations.
     */
    function update(annotations){
//        console.profile('update') 
        console.time('upd');
        _unfilteredAnnotations = annotations;
        _filterAndUpdate();
        console.timeEnd('upd');
//        console.profileEnd();
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
        setFilterQueryWithoutUpdating: setFilterQueryWithoutUpdating,
        clear: clear
    };
})();

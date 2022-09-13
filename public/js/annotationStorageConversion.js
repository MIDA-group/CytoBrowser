/**
 * Deals with converting between annotation storage objects and placed annotation
 * data. Functions in this namespace can either be used to get the
 * currently placed annotations as a storage object, which can be used for
 * local storage in a JSON file, or to add annotations from
 * an already existing annotation storage object.
 * @namespace annotationStorageConversion
 */
const annotationStorageConversion = (function() {
    "use strict";

    /**
     * A JSON representation of currently placed annotations.
     * @typedef {Object} AnnotationStorage
     * @param {number} version The specific version of the annotation storage
     * object, for back-compatibility reasons.
     * @param {string} name The name of the image where the annotations were
     * initially placed.
     * @param {Array<annotationHandler.Annotation>} annotations The actual data for
     * the annotations.
     */

    /**
     * Add annotations from an annotation storage object. The user is prompted
     * for whether or not the existing points should be replaced or
     * added to with the loaded annotations.
     * @param {Object} data The storage object containing annotation
     * information.
     */
    function addAnnotationStorageData(data, ignoreMismatch=false) {
        if (data.version === "1.0" || data.version === "1.1") {
            let currentClassSystem = classUtils.getClassConfig();

            // Ensure backward compatibility: If no class system is defined, use default system.
            let targetClassesSystem = (data.classConfig) ? data.classConfig : defaultClassConfig;

            const rebuildClassConfig = () => {
                classUtils.setClassConfig(targetClassesSystem);
                tmappUI.updateClassSelectionButtons();
                annotationHandler.updateClassConfig(targetClassesSystem);
            }

            const addAnnotations = () => {
                annotationHandler.add(data.annotations, "image");
                if (data.version === "1.1") {
                    data.comments.forEach(comment => {
                        globalDataHandler.handleCommentFromServer(comment);
                    });
                }
            }

            // Change to a collab on the right image if we're on the wrong one
            if (!ignoreMismatch && data.image !== tmapp.getImageName()) {
                tmappUI.choice("Warning: Selected data is for another image", 
                    `<p>This image: <b><tt>${escapeHtml(tmapp.getImageName())}</tt></b>` +
                    `<br>Data from: <b><tt>${escapeHtml(data.image)}</tt></b>` +
                    `</p>Any annotations outside the image will be discarded.<p>`,
                    [{
                        label: "Import anyway!",
                        click: () => { 
                            addAnnotationStorageData(data, true); 
                        }
                    }
                ]);
            }
            
            else if (!annotationHandler.isEmpty()) {
                if (classUtils.compareTwoClassSystems(currentClassSystem, targetClassesSystem)) {
                    tmappUI.choice("What should be done with the current annotations?", null, [
                        {
                            label: "Add loaded annotations to existing ones",
                            click: () => {addAnnotations();}
                        },
                        {
                            label: "Replace existing annotations with loaded ones",
                            click: () => {
                                annotationHandler.clear();
                                globalDataHandler.clear();
                                addAnnotations();
                            }
                        }
                    ]);
                }
                else {
                    tmappUI.choice("Warning: Current and loaded class systems are incompatible", null, [
                        {
                            label: "Replace class system and annotations with loaded ones",
                            click: () => {
                                annotationHandler.clear();
                                globalDataHandler.clear();
                                rebuildClassConfig();
                                addAnnotations();
                            }
                        }
                    ]);
                }
            }

            else {
                rebuildClassConfig()
                addAnnotations();
            }
        }
        else {
            throw new Error(`Data format version ${data.version} not implemented.`);
        }
    }

    /**
     * Convert the currently placed annotations to an annotation storage object.
     * @returns {Object} The annotation storage representation of the annotations.
     */
    function getAnnotationStorageData() {
        const data = {
            version: "1.1", // Version of the formatting
            image: tmapp.getImageName(),
            author: userInfo.getName(),
            updatedOn: new Date().toISOString(),
            annotations: [],
            comments: []
        };
        if (!classUtils.isDefaultClassSystem(classUtils.getClassConfig())) {
            data.classConfig = classUtils.getClassConfig();
        }
        annotationHandler.forEachAnnotation(annotation => {
            data.annotations.push(annotation)
        }, false); //don't copy computables (centroid, diameter,...) or defaults (bookmarked=false,...)
        globalDataHandler.forEachComment(comment => {
            data.comments.push(comment)
        });
        data.nAnnotations = data.annotations.length;
        data.nComments = data.comments.length;
        return data;
    }

    return {
        addAnnotationStorageData,
        getAnnotationStorageData
    }
})();

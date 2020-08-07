/**
 * Deals with converting between annotation storage objects and placed annotation
 * data. Functions in this namespace can either be used to get the
 * currently placed annotations as a storage object, which can be used for
 * either local or remote storage in a JSON file, or to add annotations from
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
    function addAnnotationStorageData(data) {
        switch (data.version) {
            case "1.0":
                const addAnnotations = () => data.annotations.forEach(annotation => {
                    annotationHandler.add(annotation, "image");
                });

                // Change image if data is for another image
                if (data.image !== tmapp.getImageName()) {
                    tmapp.openImage(data.image, () => {
                        collabClient.swapImage(data.image);
                        addAnnotations();
                    });
                }
                else if (!annotationHandler.isEmpty()) {
                    tmappUI.choice("What should be done with the current annotations?", [
                        {
                            label: "Add loaded annotations to existing ones",
                            click: addAnnotations
                        },
                        {
                            label: "Replace existing annotations with loaded ones",
                            click: () => {
                                annotationHandler.clear();
                                addAnnotations();
                            }
                        }
                    ]);
                }
                else {
                    addAnnotations();
                }
                break;
            default:
                throw new Error(`Data format version ${data.version} not implemented.`);
        }
    }

    /**
     * Convert the currently placed annotations to an annotation storage object.
     * @returns {Object} The annotation storage representation of the annotations.
     */
    function getAnnotationStorageData() {
        const data = {
            version: "1.0", // Version of the formatting
            image: tmapp.getImageName(),
            annotations: []
        };
        annotationHandler.forEachAnnotation(annotation => {
            data.annotations.push(annotation)
        });
        return data;
    }

    return {
        addAnnotationStorageData: addAnnotationStorageData,
        getAnnotationStorageData: getAnnotationStorageData
    }
})();

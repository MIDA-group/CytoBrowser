/**
 * Module for handling the visuals and logic of the collab picker.
 * @namespace collabPicker
 */
const collabPicker = (function() {
    let _lastShownImage = null;
    let _collabList = null;
    let _availableCollabs = [];

    function _retrieveCollabInfo(image) {
        let resolveLoad, rejectLoad;
        const loadPromise = new Promise((resolve, reject) => {
            resolveLoad = resolve;
            rejectLoad = reject;
        });
        const collabReq = new XMLHttpRequest();
        const address = `${window.location.api}/collaboration/available?image=${image}`;
        collabReq.open("GET", address, true);
        collabReq.send(null);
        collabReq.onreadystatechange = () => {
            if (collabReq.readyState === 4 && collabReq.status === 200) {
                const available = JSON.parse(collabReq.responseText).available;
                resolveLoad(available);
            }
            else if (collabReq.readyState === 4) {
                rejectLoad();
            }
        };
        return loadPromise;
    }

    function clear() {

    }

    function refresh(image) {
        _lastShownImage = image;
        $("#collab-image-path").text(image);
        _retrieveCollabInfo(image).then(collabData => {

        });
    }

    function open(image, forceChoice, imageCallback) {
        if (image === _lastShownImage) {
            clear();
        }
        refresh(image);
        $("#collab-picker").modal() // Open
    }

    function init() {
        // Set up the table
        _collabList = new AnnotationList("#collab-list", "#collab-list-container", "id", [
            {}
        ]);
    }

    return {
        clear: clear,
        refresh: refresh,
        open: open,
        init: init
    };
})();

/**
 * Module for handling the visuals and logic of the collab picker.
 * @namespace collabPicker
 */
const collabPicker = (function() {
    "use strict";

    let _lastShownImage = null;
    let _collabList = null;
    let _imageCallback = null;
    let _currentSelection = null;
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

    function _updateCollabList() {
        if (_collabList) {
            _collabList.updateData(_availableCollabs);
        }
        else {
            throw new Error("Tried to refresh collab picker before initialization.");
        }
    }

    function _handleCollabClick(d) {
        if (!_currentSelection) {
            _currentSelection = d.id;
            _collabList.highlightRow(d.id);
        }
        else if (d.id === _currentSelection) {
            _currentSelection = null;
            _collabList.unhighlightRow(d.id);
        }
        else {
            _collabList.unhighlightRow(_currentSelection);
            _currentSelection = d.id;
            _collabList.highlightRow(d.id);
        }
    }

    function clear() {
        _availableCollabs = [];
        _currentSelection = null;
        _collabList.unhighlightAllRows();
        _updateCollabList();
    }

    function refresh(image) {
        _lastShownImage = image;
        $("#collab-image-path").text(image);
        _retrieveCollabInfo(image).then(collabData => {
            _availableCollabs = collabData;
            _updateCollabList();
        });
    }

    function open(image, forceChoice, imageCallback) {
        const activeModal = $(".modal.show");
        activeModal.modal("hide");

        _imageCallback = imageCallback;
        if (image === _lastShownImage) { // TODO: Why did I put this here?
            clear();
        }
        refresh(image);
        $("#collab-picker").data("bs.modal", null);
        if (forceChoice) {
            $("#collab-close-button").hide();
            $("#collab-picker").modal({backdrop: "static", keyboard: false});
        }
        else {
            $("#collab-close-button").show();
            $("#collab-picker").modal();
        }

        $("#collab-picker").one("hide.bs.modal", () => activeModal.modal("show"));
    }

    function init() {
        _collabList = new AnnotationList("#collab-list", "#collab-list-container", "id", [
            {
                name: "Name",
                key: "name",
                sortable: true
            },
            {
                name: "Created by",
                key: "author",
                sortable: true
            },
            {
                name: "Updated",
                key: "updatedOn",
                sortable: true
            },
            {
                name: "# Annotations",
                key: "nAnnotations",
                sortable: true
            },
            {
                name: "# Users",
                key: "nUsers",
                sortable: true
            }
        ], _handleCollabClick);
        $("#collab-create").click(() => {
            const name = $("#collab-new-name").val();
            // Create a new collab TODO
        });
        $("#collab-list-refresh").click(() => refresh(_lastShownImage));
        $("#collab-open"); // TODO
    }

    return {
        clear: clear,
        refresh: refresh,
        open: open,
        init: init
    };
})();

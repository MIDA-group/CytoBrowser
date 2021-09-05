/**
 * Module for handling the visuals and logic of the collab picker.
 * @namespace collabPicker
 */
const collabPicker = (function() {
    "use strict";

    const _tableFields = [
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
            sortable: true,
            selectFun: d => dateUtils.formatReadableDate(d.updatedOn)
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
    ];
    let _lastShownImage = null;
    let _collabList = null;
    let _imageCallback = null;
    let _currentSelection = null;
    let _activeFilter = null;
    let _lastQueryWasValid = true;
    let _filterIsTrivial = true;
    let _availableCollabs = [];


    function _setFilterError(error) {
        const input = $("#collab-filter-query-input");
        input.addClass("is-invalid");
        input.removeClass("is-valid");
        $("#collab-filter-query-error").text(error);
    }

    function _setFilterInfo(total, remaining) {
        const input = $("#collab-filter-query-input");
        const info = `Showing ${remaining} out of ${total} sessions`;
        input.removeClass("is-invalid");
        input.addClass("is-valid");
        $("#collab-filter-query-info").text(info);
    }

    function _clearFilterInfo() {
        const input = $("#collab-filter-query-input");
        input.removeClass("is-invalid");
        input.removeClass("is-valid");
    }

    function _setFilterWithQuery(query) {
        try {
            _activeFilter = filters.getFilterFromQuery(query);
            _filterIsTrivial = query.length === 0;
            _lastQueryWasValid = true;
            if (_lastShownImage) {
                refresh(_lastShownImage);
            }
            if (_filterIsTrivial) {
                _clearFilterInfo();
            }
        }
        catch (e) {
            _lastQueryWasValid = false;
            const error = e.message;
            _setFilterError(error);
        }
    }

    function _filterCollabs(collabs) {
        if (!_activeFilter) {
            return collabs;
        }
        const filteredCollabs = _availableCollabs.filter(collab => {
            const filterableCollab = filters.preprocessCollabBeforeFiltering(collab);
            return _activeFilter.evaluate(filterableCollab);
        });
        if (_lastQueryWasValid && !_filterIsTrivial) {
            _setFilterInfo(collabs.length, filteredCollabs.length);
        }
        return filteredCollabs;
    }

    function _initFilter() {
        // Repeated logic from annotation filter, might be worth refactoring
        let keyUpTimeout = null;
        const keyUpTime = 3000;
        const input = $("#collab-filter-query-input");
        const initialQuery = input.val();
        _setFilterWithQuery(initialQuery);
        function updateQuery() {
            const query = input.val();
            _setFilterWithQuery(query);
        }
        input.keypress(e => e.stopPropagation());
        input.keyup(e => {
            e.stopPropagation();
            clearTimeout(keyUpTimeout);
            keyUpTimeout = setTimeout(updateQuery, keyUpTime);
        });
        input.keydown(e => {
            e.stopPropagation();
            if (e.code === "Escape" || e.code === "Enter" || e.code === "NumpadEnter") {
                updateQuery();
            }
        });
    }

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

    function _selectActive(id) {
        _collabList.unhighlightAllRows();
        _collabList.highlightRow(id);
        _currentSelection = id;
        $("#collab-open").prop("disabled", false);
    }

    function _unselectActive() {
        _collabList.unhighlightAllRows();
        _currentSelection = null;
        $("#collab-open").prop("disabled", true);
    }

    function _tryRetainingCurrentSelection(displayedCollabs) {
        if (_currentSelection) {
            const selectionRemains = displayedCollabs.some(collab => {
                return collab.id === _currentSelection;
            });
            if (selectionRemains) {
                _selectActive(_currentSelection);
            }
            else {
                _unselectActive();
            }
        }
    }

    function _createCollab() {
        const name = $("#collab-new-name").val();
        $("#collab-new-name").val("");
        tmapp.openImage(_lastShownImage, () => {
            if (name) {
                collabClient.createCollab(undefined, undefined, () => {
                    collabClient.changeCollabName(name);
                });
            }
            else {
                collabClient.createCollab();
            }
            _imageCallback && _imageCallback();
            $("#collab-picker").modal("hide");
        });
    }

    function _openCollab() {
        tmapp.openImage(_lastShownImage, () => {
            collabClient.connect(_currentSelection);
            _imageCallback && _imageCallback();
            $("#collab-picker").modal("hide");
        });
    }

    function _updateCollabList() {
        if (!_collabList) {
            throw new Error("Tried to refresh collab picker before initialization.");
        }
        const displayedCollabs = _filterCollabs(_availableCollabs);
        _collabList.updateData(displayedCollabs);
        _tryRetainingCurrentSelection(displayedCollabs);
    }

    function _handleCollabClick(d) {
        if (!_currentSelection) {
            _selectActive(d.id);
        }
        else if (d.id === _currentSelection) {
            _unselectActive();
        }
        else {
            _selectActive(d.id);
        }
    }

    function _handleCollabDoubleClick(d) {
        _handleCollabClick(d);
        if (_currentSelection) {
            _openCollab();
        }
    }

    /**
     * Clear the currently displayed list of collaborations.
     */
    function clear() {
        _availableCollabs = [];
        _updateCollabList();
    }

    /**
     * Refresh the list of collaborations currently shown in the
     * collaboration picker using new data from the server.
     * @param {string} image The name of the image for which to load
     * new data.
     */
    function refresh(image) {
        _lastShownImage = image;
        $("#collab-image-path").text(image); // Why here?
        _retrieveCollabInfo(image).then(collabData => {
            _availableCollabs = collabData;
            _updateCollabList();
        });
    }

    /**
     * Prompt the user to either start a new collaboration or select an
     * existing collaboration for a given image.
     * @param {string} image The name of the image being collaborated on.
     * @param {boolean} [forceChoice=false] The user cannot cancel the choice.
     * @param {Function} [imageCallback] Function to be called when the
     * image opened through the prompt has finished loading. Is passed
     * into tmapp.openImage and behaves the same way.
     */
    function open(image, forceChoice=false, imageCallback=null) {
        const activeModal = $(".modal.show");
        activeModal.modal("hide");

        _imageCallback = imageCallback;
        if (image !== _lastShownImage) {
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

    /**
     * Initialize the collab picker. Should be called before any other
     * functions in the module are called.
     */
    function init() {
        _collabList = new SortableList(
            "#collab-list",
            "#collab-list-container",
            "id",
            _tableFields,
            _handleCollabClick,
            _handleCollabDoubleClick
        );
        $("#collab-create").click(_createCollab);
        $("#collab-list-refresh").click(() => refresh(_lastShownImage));
        $("#collab-open").click(_openCollab);
        _initFilter();
    }

    return {
        clear: clear,
        refresh: refresh,
        open: open,
        init: init
    };
})();

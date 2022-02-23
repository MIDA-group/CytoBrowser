const versionRevert = (function() {
    "use strict";


    let _selection = null;

    function _deselectVersion() {
        $("#version-list a").removeClass("active");
        $("#version-revert").prop("disabled", true);
        _selection = null;
    }

    function _createVersionElement(version) {
        const element = $(`
            <a href="javascript:void(0)" class="list-group-item list-group-item-action">
            </a>
        `);
        if (_selection === version.id) {
            element.addClass("active");
        }
        let text = version.id + " ";
        if (version.time) {
            text+=dateUtils.formatReadableDate(version.time);
        }
        
        text+=` - ${version.nAnnotations} annotations`;
        element.text(text);
        element.click(() => {
            const wasSelected = _selection === version.id;
            _deselectVersion();
            if (!wasSelected) {
                $("#version-revert").prop("disabled", false);
                element.addClass("active");
                _selection = version.id;
            }
        });
        return element;
    }

    /**
     * Set a list of available versions for the current collaboration.
     * @param {Array<Object>} versions The available versions. Each
     * version object includes the fields id, time, and nAnnotations.
     */
    function setVersions(versions) {
        _deselectVersion();
        const list = $("#version-list");
        list.empty();
        versions.reverse().forEach(version => {
            const element = _createVersionElement(version);
            list.append(element);
        });
    }

    /**
     * Get an updated list of available versions for the current collaboration.
     */
    function refresh() {
        collabClient.getVersions();
    }

    /**
     * Clear the list of available versions.
     */
    function clear() {
        setVersions([]);
    }

    function init() {
        $("#version-picker").on("show.bs.modal", refresh);
        $("#version-refresh").click(refresh);
        $("#version-revert").click(() => {
            $("#version-picker").modal("hide");
            collabClient.revertVersion(_selection);
        });
    }

    return {
        setVersions: setVersions,
        refresh: refresh,
        clear: clear,
        init: init
    };
})();

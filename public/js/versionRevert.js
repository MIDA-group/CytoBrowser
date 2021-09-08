const versionRevert = (function() {
    "use strict";


    let _selection = null;

    function _deselectVersion() {
        $("#version-list a").removeClass("active");
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
        let text = dateUtils.formatReadableDate(version.time);
        if (version.isRevert) {
            text += " (Revert)";
        }
        element.text(text);
        element.click(() => {
            const wasSelected = _selection === version.id;
            _deselectVersion();
            if (!wasSelected) {
                element.addClass("active");
                _selection = version.id;
            }
        });
        return element;
    }

    /**
     * Set a list of available versions for the current collaboration.
     * @param {Array<Object>} versions The available versions. Each
     * version object includes the fields id, time, and isRevert.
     */
    function setVersions(versions) {
        if (versions.some(version => version.id === _selection)) {
            _deselectVersion();
        }
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
        clear();
        collabClient.getVersions();
    }

    /**
     * Clear the list of available versions.
     */
    function clear() {
        setVersions([]);
    }

    return {
        setVersions: setVersions,
        refresh: refresh,
        clear: clear
    };
})();

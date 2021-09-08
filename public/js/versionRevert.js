const versionRevert = (function() {
    "use strict";


    function _createVersionElement(version) {
        const element = $(`
            <a href="#" class="list-group-item list-group-item-action">
                A second link item
            </a>
        `);
    }

    /**
     * Set a list of available versions for the current collaboration.
     * @param {Array<Object>} versions The available versions. Each
     * version object includes the fields id, time, and isRevert.
     */
    function setVersions(versions) {
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

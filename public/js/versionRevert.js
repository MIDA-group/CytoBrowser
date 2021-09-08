const versionRevert = (function() {
    "use strict";


    /**
     * Set a list of available versions for the current collaboration.
     * @param {Array<Object>} versions The available versions. Each
     * version object includes the fields id, time, and isRevert.
     */
    function setVersions(versions) {
        const list = $("#version-picker");
        list.empty();
        versions.forEach(version => {
            console.log(version);
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

/**
 * Functions for storing and retrieving persistent user information.
 * @namespace userInfo
 */
const userInfo = (function() {
    "use strict";

    function _getCookies() {
        // Might not get all cookies, could be differences in formatting
        const keyValuePairs = document.cookie.match(/[^\s]+=[^;|$]*/g);
        const cookies = {};
        if (keyValuePairs) {
            keyValuePairs.map(pair => pair.split("=")).forEach(pair => {
                cookies[pair[0]] = pair[1];
            });
        }
        return cookies;
    }

    function _retrieveCookie(key) {
        const cookies = _getCookies();
        return cookies[key];
    }

    function _setCookie(key, value, duration = 1e10) {
        let expiryDate = new Date();
        expiryDate.setTime(expiryDate.getTime() + duration);
        document.cookie = `${key}=${value};samesite=strict;expires=${expiryDate.toGMTString()}`;
    }

    function setName(name) {
        _setCookie("last_used_collab_name", name);
    }

    function getName() {
        const name = _retrieveCookie("last_used_collab_name");
        return name;
    }

    return {
        setName: setName,
        getName: getName
    };
})();

/**
 * Utility functions for misc html manipulations.
 *
 * @namespace htmlUtils
 */
 const htmlUtils = (function() {
    "use strict";

    /** HTML Encode Before Inserting Untrusted Data into HTML Element Content */
    // From: https://stackoverflow.com/questions/6234773/can-i-escape-html-special-chars-in-javascript
    // See also: https://github.com/OWASP/CheatSheetSeries/blob/master/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.md#rule-1---html-encode-before-inserting-untrusted-data-into-html-element-content

    // unsafe+="<img src=doesnotexist onerror=\"alert('XSS')\">";
    const escapeHtml = (unsafe) => {
        return unsafe.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
    }

    /** 
     * forward all events from one DOM element to another
     * See: https://stackoverflow.com/questions/27321672/listen-for-all-events-in-javascript
    */
    function forwardEvents(source, target) {
        const clone = e => new e.constructor(e.type, e);
        const forward = (e) => { target.dispatchEvent(clone(e)); e.preventDefault(); };

        for (const key in source) {
            if(/^on/.test(key)) {
                const eventType = key.substr(2);
                source.addEventListener(eventType, forward);
            }
        }
    }

    return {
        escapeHtml,
        forwardEvents
    };
})();

//I think this one may live in the global namespace
const escapeHtml = htmlUtils.escapeHtml;

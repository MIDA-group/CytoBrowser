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

    return {
        escapeHtml
    };
})();

//I think this one may live in the global namespace
const escapeHtml = htmlUtils.escapeHtml;

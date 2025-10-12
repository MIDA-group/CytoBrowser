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

    /** Insert script */
    const loadJS = function(url, element, implementationCode=null) {
        //url is URL of external file
        //element is where to append the <script> element
        //implementationCode is code to be called from the file
        var scriptTag = document.createElement('script');
        scriptTag.src = url;
        scriptTag.type = "module"; // Modules are loaded only once
        if (implementationCode) {
            scriptTag.onload = implementationCode;
        }
        element.appendChild(scriptTag);
    };
 
    const loadCSS = function(url) {
        document.head.insertAdjacentHTML(
            'beforeend',
            '<link rel="stylesheet" type="text/css" href="css/console2html.css" />');
    }

    return {
        escapeHtml,
        loadJS,
        loadCSS
    };
})();

//I think these may live in the global namespace
const escapeHtml = htmlUtils.escapeHtml;
const loadJS = htmlUtils.loadJS;
const loadCSS = htmlUtils.loadCSS;

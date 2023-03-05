/**
 * Utility functions for XMLHttpRequest (XHR) related stuff.
 *
 * @namespace XHRUtils
 */
 const XHRUtils = (function() {
    "use strict";

    /**
     * Promisified XHR function
     * https://stackoverflow.com/questions/48969495/in-javascript-how-do-i-should-i-use-async-await-with-xmlhttprequest
     * @param {*} method 
     * @param {*} url 
     * @param {boolean} noCache
     */
    function makeRequest(method, url, noCache=true) {
        return new Promise(function (resolve, reject) {
            let xhr = new XMLHttpRequest();
            xhr.open(method, url);

            if (noCache) {
                // Turn off caching of response
                xhr.setRequestHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0"); // HTTP 1.1
                xhr.setRequestHeader("Pragma", "no-cache"); // HTTP 1.0
                xhr.setRequestHeader("Expires", "0"); // Proxies
            }
            
            xhr.onload = function () {
                if (this.status >= 200 && this.status < 300) {
                    resolve(xhr.responseText);
                } else {
                    reject({
                        status: this.status,
                        statusText: xhr.statusText
                    });
                }
            };
            xhr.onerror = function () {
                reject({
                    status: this.status,
                    statusText: xhr.statusText
                });
            };
            xhr.send();
        });
    }

    return {
        makeRequest
    };
})();

//I think this one may live in the global namespace
const promiseHttpRequest = XHRUtils.makeRequest;

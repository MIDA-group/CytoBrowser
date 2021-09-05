/**
 * Utility functions for working with date representations throughout
 * the code.
 * @namespace dateUtils
 */
const dateUtils = (function() {
    /**
     * Formats a given date representation as a string of the format
     * YYYY-MM-DD HH:mm.
     * @param {Date|string} date The unformatted date.
     */
    function formatReadableDate (date) {
        if (typeof date !== "object") {
            date = new Date(date);
        }
        function withZero(x) {
            return x > 9 ? x : "0" + x;
        }
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const readableDate = `${year}-${withZero(month)}-${withZero(day)} ${withZero(hours)}:${withZero(minutes)}`;
        return readableDate;
    }

    return {
        formatReadableDate: formatReadableDate
    };
})();

class AnnotationList {
    "use strict";

    /**
     * Object that contains information about a single field in the
     * annotation list. Each field corresponds to a single key-value
     * pair in the processed data, as well as a single column in the list.
     * @typedef {Object} AnnotationListField
     * @property {string} name The name that should be displayed at the
     * top of the column for the field.
     * @property {string} key The key that should be used to access
     * data from this field.
     * @property {string} [title] The text that should be displayed when
     * hovering over the name of this field.
     * @property {Function} [selectFun] The function that should be called
     * to create the data for this field from raw data. If undefined,
     * the data will be acquired by accessing the raw data using the
     * field's key.
     * @property {Function} [displayFun] Function that should be used to
     * display the data for this field. The function should take two
     * arguments, the first being a DOM element where the data should
     * be displayed and the second being a datum.
     * @property {boolean} [sortable] Whether or not the data in this
     * field can be used to sort the annotations. Defaults to false.
     * @property {string} [minWidth] The minimum width of the column for
     * this field.
     */

    /**
     * @param table Any value that can be selected by d3 to access a
     * table element in which the annotations should be listed.
     * @param scroller Any value that can be selected by jQuery to access
     * the element to which the scrollbar of the list belongs.
     * @param {string} idKey The key that should be used to uniquely
     * identify each data item. Is also used for the default sorting.
     * @param {Array<AnnotationListField>} fields The fields that should
     * be used for the columns in the list.
     */
    constructor(table, scroller, idKey, fields) {
        this._fields = fields;
        this._data = [];
        this._idKey = idKey;
        this._table = d3.select(table);
        this._scroller = scroller;
        this._createHeaderRowAndBody();
        this.unsetSorted();
    }

    _createHeaderRowAndBody() {
        const colGroup = this._table.append("colgroup");
        const row = this._table
            .append("thead")
            .append("tr")
            .attr("class", "header-row");
        this._fields.forEach(field => {
            const col = colGroup.append("col");
            if (field.minWidth) {
                col.style("min-width", field.minWidth);
            }
            if (field.sortable) {
                row.append("th")
                    .on("click", () => this._progressSort(field.key))
                    .style("cursor", "pointer")
                    .style("user-select", "none")
                    .attr("class", "p-1")
                    .attr("title", field.title ? field.title : field.name)
                    .text(field.name)
                    .append("span")
                    .attr("class", "sort-indicator ml-1")
                    .style("width", "1em")
                    .attr("data-key", field.key);
            }
            else {
                row.append("th")
                    .style("user-select", "none")
                    .text(field.name);
            }

        });
        this._table.append("tbody");
    }

    _setData(rawData) {
        this._data = rawData.map(datum => {
            const adjustedDatum = {};
            adjustedDatum[this._idKey] = datum[this._idKey];
            this._fields.forEach(field => {
                if (field.selectFun) {
                    adjustedDatum[field.key] = field.selectFun(datum);
                }
                else {
                    adjustedDatum[field.key] = datum[field.key];
                }
            });
            return adjustedDatum;
        });
    }

    _displayData() {
        const fields = this._fields;
        this._table.select("tbody")
            .selectAll(".data-row")
            .data(this._data, d => d[this._idKey])
            .join("tr")
            .attr("class", "data-row")
            .attr("data-annotation-id", d => d[this._idKey])
            .order((a, b) => a.a < b.a)
            .each(function(d) {
                d3.select(this)
                    .selectAll("td")
                    .data(fields)
                    .join("td")
                    .attr("class", "p-1")
                    .style("vertical-align", "middle")
                    .each(function(f) {
                        if (f.displayFun) {
                            f.displayFun(this, d);
                        }
                        else {
                            d3.select(this).text(d[f.key]);
                        }
                    });
            });
    }

    _reorderData() {
        let sortIcon;
        if (this._sortDirection === "ascending") {
            sortIcon = "&#x2193;";
            this._table.selectAll(".data-row")
                .data(this._data, d => d[this._idKey])
                .sort((a, b) => a[this._sortKey] > b[this._sortKey]);
        }
        else if (this._sortDirection === "descending") {
            sortIcon = "&#x2191;";
            this._table.selectAll(".data-row")
                .data(this._data, d => d[this._idKey])
                .sort((a, b) => a[this._sortKey] < b[this._sortKey]);
        }
        const sortKey = this._sortKey;
        this._table.select(".header-row")
            .selectAll(".sort-indicator")
            .html(function() {
                const key = d3.select(this).attr("data-key");
                return key === sortKey ? sortIcon : "&#x21C5;";
            });
    }

    _progressSort(key) {
        if (this._sortKey === key) {
            if (this._sortDirection === "ascending") {
                this.setDescending(key);
            }
            else if (this._sortDirection === "descending") {
                this.unsetSorted();
            }
        }
        else {
            this.setAscending(key);
        }
    }

    updateData(data) {
        this._setData(data);
        this._displayData();
        this._reorderData();
    }

    /**
     * Reorder the list to ascend.
     * @param {string} key The key to sort the list based on.
     */
    setAscending(key) {
        this._sortKey = key;
        this._sortDirection = "ascending";
        this._reorderData();
    }

    /**
     * Reorder the list to descend.
     * @param {string} key The key to sort the list based on.
     */
    setDescending(key) {
        this._sortKey = key;
        this._sortDirection = "descending";
        this._reorderData();
    }

    /**
     * Reset the list to its default order.
     */
    unsetSorted() {
        this.setAscending(this._idKey);
    }

    /**
     * Scroll the list to a given item.
     * @param {number} id The id of the given item.
     */
    goToRow(id) {
        const scroller = $(this._scroller);
        const row = $(`tr[data-annotation-id=${id}]`);
        const headerOffset = scroller.offset().top;
        const currentScroll = scroller.scrollTop();
        const rowOffset = row.offset().top;
        scroller.scrollTop(currentScroll + rowOffset - headerOffset);
    }
}

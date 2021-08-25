class AnnotationList {
    "using strict";

    constructor(table, idKey, fields) {
        this.fields = fields;
        this.data = [];
        this.idKey = idKey;
        this.table = d3.select(table);
        this._createHeaderRowAndBody();
        this.unsetSorted();
    }

    _createHeaderRowAndBody() {
        const row = this.table
            .append("thead")
            .append("tr")
            .attr("class", "header-row");
        this.fields.forEach(field => {
            if (field.sortable) {
                row.append("th")
                    .on("click", () => this._progressSort(field.key))
                    .style("cursor", "pointer")
                    .style("user-select", "none")
                    .text(field.name)
                    .append("span")
                    .attr("class", "sort-indicator float-right")
                    .style("width", "1em")
                    .attr("data-key", field.key);
            }
            else {
                row.append("th")
                    .style("user-select", "none")
                    .text(field.name);
            }

        });
        this.table.append("tbody");
    }

    _setData(rawData) {
        this.data = rawData.map(datum => {
            const adjustedDatum = {};
            adjustedDatum[this.idKey] = datum[this.idKey];
            this.fields.forEach(field => {
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
        const fields = this.fields;
        this.table.select("tbody")
            .selectAll(".data-row")
            .data(this.data, d => d[this.idKey])
            .join("tr")
            .attr("class", "data-row")
            .order((a, b) => a.a < b.a)
            .each(function(d) {
                d3.select(this)
                    .selectAll("td")
                    .data(fields)
                    .join("td")
                    .each(function(f) {
                        if (f.displayFun) {
                            d3.select(this).html(f.displayFun(d));
                        }
                        else {
                            d3.select(this).text(d[f.key]);
                        }
                    });
            });
    }

    _reorderData() {
        let sortIcon;
        if (this.sortDirection === "ascending") {
            sortIcon = "&#x2193;";
            this.table.selectAll(".data-row")
                .data(this.data, d => d[this.idKey])
                .sort((a, b) => a[this.sortKey] > b[this.sortKey]);
        }
        else if (this.sortDirection === "descending") {
            sortIcon = "&#x2191;";
            this.table.selectAll(".data-row")
                .data(this.data, d => d[this.idKey])
                .sort((a, b) => a[this.sortKey] < b[this.sortKey]);
        }
        const sortKey = this.sortKey;
        this.table.select(".header-row")
            .selectAll(".sort-indicator")
            .html(function() {
                const key = d3.select(this).attr("data-key");
                return key === sortKey ? sortIcon : "&#x21C5;";
            });
    }

    _progressSort(key) {
        if (this.sortKey === key) {
            if (this.sortDirection === "ascending") {
                this.setDescending(key);
            }
            else if (this.sortDirection === "descending") {
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
        this.sortKey = key;
        this.sortDirection = "ascending";
        this._reorderData();
    }

    /**
     * Reorder the list to descend.
     * @param {string} key The key to sort the list based on.
     */
    setDescending(key) {
        this.sortKey = key;
        this.sortDirection = "descending";
        this._reorderData();
    }

    /**
     * Reset the list to its default order.
     */
    unsetSorted() {
        this.setAscending(this.idKey);
    }

    /**
     * Scroll the list to a given item.
     * @param {number} id The id of the given item.
     */
    goToRow(id) {
        throw new Error("Moving to row not yet implemented.");
    }
}

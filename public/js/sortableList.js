
const timingLog = false; //Log add/update times
class SortableList {
    "use strict";

    /**
     * Object that contains information about a single field in the
     * annotation list. Each field corresponds to a single key-value
     * pair in the processed data, as well as a single column in the list.
     * @typedef {Object} SortableListField
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
     * @property {() => string} [displayStyle] Typically "none" to make 
     * column invisible
     */

    /**
     * @param table Any value that can be selected by d3 to access a
     * table element in which the annotations should be listed.
     * @param scroller Any value that can be selected by jQuery to access
     * the element to which the scrollbar of the list belongs.
     * @param {string} idKey The key that should be used to uniquely
     * identify each data item. Is also used for the default sorting.
     * @param {Array<SortableListField>} fields The fields that should
     * be used for the columns in the list.
     * @param {Function} [onClick] Function to be called when a row
     * in the list is clicked, passing the data on that row as an
     * argument. If omitted, nothing happens when a row is clicked.
     * @param {Function} [onDoubleClick] Function to be called when a row
     * in the list is double clicked, passing the data on that row as an
     * argument. If omitted, nothing happens when a row is double clicked.
     * @param {Function} [anchor] Functions generating href
     * for an anchor <a></a> wrapping each cell in a row.
     */
    constructor(table, scroller, idKey, fields, onClick=null, onDoubleClick=null, anchor=null) {
        this._fields = fields;
        this._data = [];
        this._idKey = idKey;
        this._table = d3.select(table);
        this._scroller = scroller;
        this._onClick = onClick;
        this._onDoubleClick = onDoubleClick;
        this._anchor = anchor;
        this._createHeaderRowAndBody();
        this.unsetSorted();
        this._unboldTimeout = 0;
        this._maxCount = 1000; //button-click to show more rows (possibly slow)
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
            const th = row.append("th")
                .style("user-select", "none")
                .text(field.name);
            if (field.displayStyle) {
                th.style("display", field.displayStyle());
            }
            if (field.sortable) {
                th.on("click", () => this._progressSort(field.key))
                    .style("cursor", "pointer")
                    .attr("class", "p-1")
                    .attr("title", field.title ? field.title : field.name)
                    .append("span")
                    .attr("class", "sort-indicator ml-1")
                    .style("width", "1em")
                    .attr("data-key", field.key);
            }
        });
        this._table.append("tbody");
    }

    _updateDisplayStyle() {
        let changed=false;
        const th = this._table.selectAll("th")
            .data(this._fields)
            .join("th");
        th.each(function(f) {
            if (f.displayStyle) {
                if (changed || d3.select(this).style("display") !== f.displayStyle()) {
                    d3.select(this).style("display", f.displayStyle());
                    changed=true;
                }
            }
        });
        return changed;
    }

    //TODO(?): Is there actually a point in keeping two arrays? Just use rawData directly instead?
    // _data has proporty "changed" which is true if _setData made a change (not verified to work with selectFun)
    _setData(rawData) {
        timingLog && console.time("setListData");
        let updates=0;
        this._data = rawData.map((datum,index) => {
            const old = this._data[index];

            const adjustedDatum = {};
            adjustedDatum.changed = old == null || old.changed; //keep changed (if not displayed, e.g., due to _maxCount
            adjustedDatum[this._idKey] = datum[this._idKey];
            adjustedDatum.changed || old[this._idKey] === adjustedDatum[this._idKey] || (adjustedDatum.changed=true);
            adjustedDatum.rawRef=datum; //reference to the original raw data
            this._fields.forEach(field => {
                if (field.selectFun) {
                    adjustedDatum[field.key] = field.selectFun(datum);
                }
                else {
                    adjustedDatum[field.key] = datum[field.key];
                }
                adjustedDatum.changed || old[field.key] === adjustedDatum[field.key] || (adjustedDatum.changed=true); //||=
            });
            adjustedDatum.changed && updates++;
            return adjustedDatum;
        });
        timingLog && console.timeEnd("setListData");
        //console.log(`Made ${updates} updates in list`);
    }

    _displayData(force = false) {
        timingLog && console.time("dispListData");
        const list = this;
        if (list._anchor) tmapp.makeURL(); //make sure it's updatable; CROCK: only needed if we use URL-update

        //Remove any overflowRow
        this._table.select("tbody")
            .selectAll(".overflowRow")
            .remove();

        const fields = this._fields;
        const rows = this._table.select("tbody")
            .selectAll(".data-row")
            .data(this._data.slice(0,this._maxCount), d => d[this._idKey])
            .join("tr")
            .attr("class", "data-row")
            .attr("data-annotation-id", d => d[this._idKey]);

        const changed = force? rows: rows.filter((d, i) => d.changed); 
        const doneChanges = new Promise((resolve, reject) => {
            if (changed.empty()) {
                resolve();
            }
            else {
                changed
                    .style("font-weight", "bold") // bold changes
                    .each(function(d) { // each row (no arrow function, to keep 'this')
                        if (list._onClick || list._onDoubleClick) {
                            d3.select(this)
                                .style("cursor", "pointer")
                                .style("user-select", "none");
                            if (list._onClick) {
                                d3.select(this).on("click", () => list._onClick(d));
                            }
                            if (list._onDoubleClick) {
                                d3.select(this).on("dblclick", () => list._onDoubleClick(d));
                            }
                        }
                        const td=d3.select(this)
                            .selectAll("td")
                            .data(fields)
                            .join("td")
                            .attr("class", "px-0 py-1")
                            .style("vertical-align", "middle");

                        td.each(function(f) { //each column
                            if (f.displayStyle) {
                                d3.select(this).style("display",f.displayStyle());
                            } 
                        });

                        let elem=td; //td or anchor 
                        if (list._anchor) { // wrap content in an anchor <a>...</a>
                            const href = list._anchor(d);
                            td.each(function() { //each column
                                if (!d3.select(this).select("a").node()) { //all which do not have an anchor
                                    d3.select(this).append("a"); //append one
                                }
                            });
                            elem=td.select("a").attr("href", href);
                        }

                        //td or anchor
                        elem.each(function(f) { //each column
                            if (f.displayFun) {
                                f.displayFun(this, d);
                            }
                            else {
                                d3.select(this).text(d[f.key]);
                            }
                        });
                        
                        d.changed=false; //set changed=false when shown
                    })
                    .transition()
                    .end()
                    .then(() => {
                        // console.log('Done with List rendering');
                        resolve(); 
                    })
                    .catch(() => {
                        // console.warn('Sometimes we get a reject, just ignore!');
                        // reject(); 
                        resolve(); //This also indicates that we're done
                    });
            }
        });

        //Add overflowRow last 
        if (this._maxCount<this._data.length) {
            this._table.select("tbody")
                .selectAll(".overflowRow")
                .data([[`Elements 1\u2013${this._maxCount} of ${this._data.length}`]]) //\u2013 = n-dash
                .join("tr")
                .attr("class","overflowRow")
                .selectAll("td")
                .data(d => d)
                .join("td")
                .attr("colspan",fields.length)
                .text(d => d)
                .attr("title", "List truncated for reasons of speed. Use 'Filter' to select the data you wish to display.")
                .selectAll("button")
                .data(['<i class="fa fa-chevron-down pr-1"></i> SHOW MORE'])
                .join("button")
                .classed("btn btn-secondary mx-1 ml-2", true)
                .html(d => d)
                .attr("title", "Show more rows in list")
                .on("click", () => { this._maxCount *= 10; this._displayData(force); });
        } 

        doneChanges
            .then(() => {
                this.updateData.inProgress(false);

            //Avoids flicker, but fails if the selection changes
                // if (this._unboldTimeout) {
                //     clearTimeout(this._unboldTimeout);
                // }

                this._unboldTimeout = setTimeout(() => {
                    changed.style("font-weight", "normal");
                    this._unboldTimeout = 0;
                }, 2000); //unbold after 2s
            })
            .catch((err) => { 
                console.warn('Annotation rendering reported an issue: ',err); 
            });

        timingLog && console.timeEnd("dispListData"); //Async so reaching here early
    }

    _reorderData() {
        timingLog && console.time("sortListData");
        let sortIcon;
        if (this._sortDirection === "ascending") {
            sortIcon = "&#x2193;";
            this._table.selectAll(".data-row")
                .data(this._data, d => d[this._idKey])
                .sort((a, b) => d3.ascending(b[this._sortKey],a[this._sortKey]));
        }
        else if (this._sortDirection === "descending") {
            sortIcon = "&#x2191;";
            this._table.selectAll(".data-row")
                .data(this._data, d => d[this._idKey])
                .sort((a, b) => d3.descending(b[this._sortKey],a[this._sortKey]));
        }
        else { //data order
            this._table.selectAll(".data-row")
                .data(this._data, d => d[this._idKey])
                .order();
        }
        const sortKey = this._sortKey; //variable capture
        this._table.select(".header-row")
            .selectAll(".sort-indicator")
            .html(function() {
                const key = d3.select(this).attr("data-key");
                return key === sortKey ? sortIcon : '<span class="text-muted">&#x2195;</span>';
            });
        timingLog && console.timeEnd("sortListData");
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
        this.updateData.inProgress(true); //No function 'self' existing

        const changed=this._updateDisplayStyle();
        this._setData(data);
        this._displayData(changed); //may be slow if large data, calls inProgress(false) when done
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
        this._sortKey = null;
        this._sortDirection = null;
        this._reorderData();
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

    /**
     * Visually highlight a given row.
     * @param id The id of the given item.
     */
    highlightRow(id) {
        const row = $(`tr[data-annotation-id=${id}]`);
        row.addClass("bg-primary");
        row.addClass("text-white");
    }

    /**
     * Unhighlight a given item.
     * @param id The id of the given item.
     */
    unhighlightRow(id) {
        const row = $(`tr[data-annotation-id=${id}]`);
        row.removeClass("bg-primary");
        row.removeClass("text-white");
    }

    /**
     * Unhighlight all items.
     */
    unhighlightAllRows() {
        this._data.forEach(datum => {
            this.unhighlightRow(datum[this._idKey]);
        });
    }
}
// Boolean to check if we're busy rendering
SortableList.prototype.updateData.inProgress = (function () { let flag = false; return (set=null) => { if (set!=null) flag=set; return flag; }} )();

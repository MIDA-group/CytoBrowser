/**
 * Namespace used to collect all the functions related to the file
 * browser interface, as this was taking up a lot of space in the tmappUI
 * namespace.
 * @namespace fileBrowserUI
 */
const fileBrowserUI = (function() {
    "use strict";

    let _selectedFile,
        _path = [];

    function _openDirectory(entries, name = "", updatePath = true) {
        if (updatePath) {
            if (!name) {
                _path = [];
            }
            else if (name === "..") {
                _path.pop();
            }
            else {
                _path.push(name);
            }
        }

        $("#server_file_path").text(`storage/${_path.join("/")}`);
        const list = d3.select("#server_files");
        list.selectAll("a")
            .data(entries, d => d.name)
            .join(enter => enter.append("a")
                .attr("class", "list-group-item list-group-item-action \
                    d-flex justify-content-between align-items-center")
                .attr("href", "#")
                .attr("filename", d => d.name)
                .attr("entrytype", d => d.type)
                .call(selection =>
                    selection.append("span")
                    .text(d => `${d.name}${d.type === "directory" ? "/" : ""}`)
                    .filter(d => d.versions)
                    .append("span")
                    .attr("class", "small")
                    .html(d => `&nbsp;&nbsp;&nbsp;&nbsp;(${d.versions.length + 1} versions available)`)
                )
                .call(selection =>
                    selection.filter(d => d.mtime)
                    .append("span")
                    .attr("class", "small")
                    .text(d => new Date(d.mtime).toLocaleString())
                )
                .on("click", d => _setSelectedFile(d))
                .on("dblclick", d => {
                    _setSelectedFile(d);
                    _openSelectedFile();
                })
            );
    }

    function _setSelectedFile(file) {
        _selectedFile = file;
        $("#server_files").children().removeClass("active");
        $(`#server_files [filename="${file.name}"]`).addClass("active");
        $("#server_load").prop("disabled", false);
        if (file.type === "file") {
            $("#server_filename").val(file.name);
        }
    }

    function _clearSelectedFile() {
        _selectedFile = null;
        $("#server_files").children().removeClass("active");
        $("#server_load").prop("disabled", true);
    }

    function _selectVersion(file){
        $("#server_storage").modal("hide");
        $("#version_list").empty();
        const currentButton = $(`<button class='btn btn-primary btn-block'>
            Current version &ndash;
            Modified ${new Date(file.mtime).toLocaleString()}
        </button>`);
        currentButton.click(() => {
            remoteStorage.loadJSON(`${_path.join("/")}${file.name}`)
            .then(markerStorageConversion.addMarkerStorageData);
            $("#version_select").modal("hide");
        });
        $("#version_list").append(currentButton);
        file.versions.sort((a, b) => b.number - a.number).forEach(version => {
            const versionButton = $(`<button class='btn btn-secondary btn-block'>
                Version ${version.number} &ndash;
                Modified ${new Date(version.mtime).toLocaleString()}
            </button>`);
            versionButton.click(() => {
                remoteStorage.loadJSON(`${_path.join("/")}/`+
                `__version_${version.number}__${file.name}`)
                .then(markerStorageConversion.addMarkerStorageData);
                $("#version_select").modal("hide");
            });
            $("#version_list").append(versionButton);
        });
        $("#version_select").modal("show");
    }

    function _openSelectedFile() {
        if (!_selectedFile) {
            throw new Error("No file selected.");
        }
        if (_selectedFile.type === "file" && _selectedFile.versions) {
            _selectVersion(_selectedFile);
        }
        else if (_selectedFile.type === "file") {
            remoteStorage.loadJSON(`${_path.join("/")}/${_selectedFile.name}`)
            .then(markerStorageConversion.addMarkerStorageData);
            $("#server_storage").modal("hide");
        }
        else if (_selectedFile.type === "directory") {
            _openDirectory(_selectedFile.content, _selectedFile.name);
        }
        _clearSelectedFile();
    }

    function _saveFile() {
        const filename = $("#server_filename").val();
        const data = markerStorageConversion.getMarkerStorageData();
        const path = _path.join("/");
        remoteStorage.saveJSON(data, filename, path).then(() => {
            _updateRemoteFiles();
        });
    }

    function _updateRemoteFiles() {
        remoteStorage.files().then(files => {
            const newPath = [];
            let name = "";
            let entries = files;
            for (let i in _path) {
                let step = _path[i];
                let subEntries = entries.find(entry => entry.name === step);
                if (subEntries) {
                    name = step;
                    entries = subEntries.content;
                    newPath.push(step);
                }
                else {
                    break;
                }
            }
            _path = newPath;
            $("#server_files").empty();
            _openDirectory(entries, name, false);
        });
    }

    /**
     * Initialize event handlers for buttons in the file browser.
     */
    function init() {
        _updateRemoteFiles();
        $("#server_refresh").click(_updateRemoteFiles);
        $("#server_load").click(_openSelectedFile);
        $("#server_save").click(_saveFile);
    }

    return {
        init: init
    };
})();

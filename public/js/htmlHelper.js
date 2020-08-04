/**
 * Functions for generating different HTML components needed in other
 * parts of the code, to avoid making a mess elsewhere.
 * @namespace htmlHelper
 */
const htmlHelper = (function() {
    function _markerValueRow(label, value) {
        return $(`
            <div class="form-group row">
                <label class="col-4 col-form-label">
                    ${label}
                </label>
                <div class="col-8">
                    <input type="text" readonly class="form-control" value="${value}">
                </div>
            </div>
        `);
    }

    function _markerMclassOptions(marker) {
        const container = $(`
            <div class="form-group row">
                <label class="col-4 col-form-label">
                    Class
                </label>
                <div class="col-8">
                    <select class="form-control">
                    </select>
                </div>
            </div>
        `);
        bethesdaClassUtils.forEachClass(mclass => {
            const selected = marker.mclass === mclass.name;
            const option = $(`
                <option ${selected ? "selected='selected'" : ""}>
                    ${mclass.name}
                </option>
            `);
            container.find("select").append(option);
        });
        return container;
    }

    function _markerComment(comment, removeFun) {
        const entry = $(`
            <li class="list-group-item">
                <p>${comment.body}</p>
                <div class="small d-flex justify-content-between">
                    <span class="text-muted">
                        Added by ${comment.author}
                    </span>
                    <a href="#">
                        Remove
                    </a>
                </div>
            </li>
        `);
        const removeBtn = entry.find("a");
        removeBtn.click(removeFun);
        return entry;
    }

    function _markerCommentList(marker) {
        if (!marker.comments)
            marker.comments = [];
        const comments = marker.comments;

        const container = $(`
            <div class="card bg-secondary mb-2" style="height: 25vh; overflow-y: auto;">
                <ul class="list-group list-group-flush">
                </ul>
            </div>
        `);
        container.appendMarkerComment = comment => {
            const entry = _markerComment(comment, () => {
                const index = comments.indexOf(comment);
                comments.splice(index);
                entry.remove();
            });
            list.append(entry);
        };
        const list = container.find("ul");
        comments.forEach(container.appendMarkerComment);
        return container;
    }

    function _markerCommentInput(inputFun) {
        const container = $(`
            <div class="input-group mb-4">
                <textarea class="form-control" rows="2" style="resize: none;"></textarea>
                <div class="input-group-append">
                    <button type="button" class="btn btn-primary">Add comment</button>
                </div>
            </div>
        `);
        container.find("button").click(() => {
            const body = container.find("textarea").val();
            inputFun(body);
        });
        return container;
    }

    function _markerSaveButton(marker, saveFun) {
        const button = $(`
            <button class="btn btn-primary btn-block">
                Save changes
            </button>
        `);
        button.click(saveFun);
        return button;
    }

    function buildMarkerSettingsMenu(container, marker, saveFun) {
        const id = _markerValueRow("Id", marker.id);
        const author = _markerValueRow("Created by", marker.author);
        const classes = _markerMclassOptions(marker);
        const list = _markerCommentList(marker);
        const input = _markerCommentInput(body => {
            const comment = {
                author: userInfo.getName(),
                body: body
            };
            list.appendMarkerComment(comment);
            marker.comments.push(comment);
        });
        const saveBtn = _markerSaveButton(marker, saveFun);
        container.append(id, author, classes, list, input, saveBtn);
    }

    return {
        buildMarkerSettingsMenu: buildMarkerSettingsMenu
    };
})();

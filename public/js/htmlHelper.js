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
        const select = container.find("select");
        bethesdaClassUtils.forEachClass(mclass => {
            const selected = marker.mclass === mclass.name;
            const option = $(`
                <option value="${mclass.name}" ${selected ? "selected='selected'" : ""}>
                    ${mclass.name}
                </option>
            `);
            select.append(option);
        });
        select.change(() => marker.mclass = select.val());
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
            <div class="card bg-secondary mb-2" style="height: 15vh; overflow-y: auto;">
                <ul class="list-group list-group-flush">
                </ul>
            </div>
        `);
        container.appendMarkerComment = comment => {
            const entry = _markerComment(comment, () => {
                const index = comments.indexOf(comment);
                comments.splice(index);
                entry.closest("[tabindex]").focus();
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
                <textarea class="form-control" rows="1" style="resize: none;"></textarea>
                <div class="input-group-append">
                    <button type="button" class="btn btn-primary">Add comment</button>
                </div>
            </div>
        `);
        container.find("button").click(() => {
            const textarea = container.find("textarea");
            const body = textarea.val();
            textarea.val("");
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

    function _classSelectionButton(mclass, active) {
        const button = $(`
            <label id="class_${mclass.name}" class="btn btn-dark" title="${mclass.description}">
                <input type="radio" name="class_options" autocomplete="off">${mclass.name}</input>
            </label>
        `);
        if (active)
            button.addClass("active");
        button.click(() => {
            tmapp.setMclass(mclass.name);
        });
        return button;
    }

    function _collaboratorListEntry(member, active) {
        const entry = $(`
            <a class="list-group-item list-group-item-action d-flex
            justify-content-between align-items-center" href="#">
                <span>
                    <span class="badge badge-pill" style="background-color: ${member.color};">
                        &nbsp;
                    </span>
                    &nbsp;&nbsp;&nbsp;
                    ${member.name}
                </span>
                <span>
                    <input type="checkbox">
                </span>
            </a>
        `);
        if (!active)
            entry.addClass("disabled");
        entry.click(event => {
            event.preventDefault();
            entry.closest(".modal").modal("hide");
            tmapp.moveTo(member.position);
        });
        const checkbox = entry.find("input");
        checkbox.prop("checked", member.followed);
        checkbox.click(event => {
            event.stopPropagation();
            if (event.target.checked)
                collabClient.followView(member);
            else
                collabClient.stopFollowing();
        });
    }

    /**
     * Fill a jquery selection with the nodes for editing a marker.
     * @param {Object} container The selection that should contain the
     * marker editing menu.
     * @param {markerHandler.MarkerPoint} marker The marker that should
     * be editable through the created menu.
     * @param {Function} saveFun The function that should be run when
     * pressing the save button in the menu.
     */
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

    /**
     * Fill a jquery selection with the nodes for selecting a class.
     * @param {Object} container The selection that should contain the
     * class selection buttons.
     * @param {number} activeIndex The index of the initially selected
     * class.
     */
    function buildClassSelectionButtons(container, activeIndex) {
        bethesdaClassUtils.forEachClass((mclass, index) => {
            const active = activeIndex === index;
            const button = _classSelectionButton(mclass, active);
            container.append(button);
        });
    }

    /**
     * Fill a jquery selection with a list of collaborators.
     * @param {Object} container The selection that should contain the
     * collaborators.
     * @param {Object} localMember The collaborator local to the client.
     * @param {Array<Object>} members All members present in the collaboration.
     */
    function buildCollaboratorList(container, localMember, members) {
        members.forEach(member => {
            const isLocal = localMember === member;
            const isActive = !isLocal && member.ready;
            const entry = _collaboratorListEntry(member, isActive);
            container.append(entry);
        });
    }

    return {
        buildMarkerSettingsMenu: buildMarkerSettingsMenu,
        buildClassSelectionButtons: buildClassSelectionButtons
    };
})();

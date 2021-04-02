/**
 * Functions for generating different HTML components needed in other
 * parts of the code, to avoid making a mess elsewhere.
 * @namespace htmlHelper
 */
const htmlHelper = (function() {

    function _scaleRGB(color, scale) {
        return '#' + color.replace(/^#/, '').replace(/../g, color =>
          ('0' + Math.min(255, Math.max(0, Math.round(parseInt(color, 16) * scale))).toString(16)).substr(-2));
    }

    function _annotationValueRow(label, value) {
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

    function _annotationMclassOptions(annotation, updateFun) {
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
        classUtils.forEachClass(mclass => {
            const selected = annotation.mclass === mclass.name;
            const option = $(`
                <option value="${mclass.name}" ${selected ? "selected='selected'" : ""}>
                    ${mclass.name}
                </option>
            `);
            select.append(option);
        });
        select.change(() => {
            annotation.mclass = select.val();
            updateFun();
        });
        return container;
    }

    function _annotationComment(comment, removeFun) {
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

    function _annotationCommentList(annotation, updateFun) {
        if (!annotation.comments)
            annotation.comments = [];
        const comments = annotation.comments;

        const container = $(`
            <div class="card bg-secondary mb-2" style="height: 15vh; overflow-y: auto;">
                <ul class="list-group list-group-flush">
                </ul>
            </div>
        `);
        container.appendAnnotationComment = comment => {
            const entry = _annotationComment(comment, event => {
                event.preventDefault();
                const index = comments.indexOf(comment);
                comments.splice(index, 1);
                entry.closest("[tabindex]").focus();
                entry.remove();
                updateFun();
            });
            list.append(entry);
            updateFun();
        };
        const list = container.find("ul");
        comments.forEach(container.appendAnnotationComment);
        return container;
    }

    function _annotationCommentInput(inputFun) {
        const container = $(`
            <div class="input-group">
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

    function _classSelectionButton(mclass, active) {
        const active_color=_scaleRGB(mclass.color,0.5);

        //To set 'style="background-color: ${mclass.color};"' works here, but se we cannot use
        //pseudo-selectors (e.g. hover) in inline style, we do all colors below with CSS
        const button = $(`
            <label id="class_${mclass.name}" class="btn btn-dark px-0 px-md-1 px-lg-2" title="${mclass.description}">
                <input type="radio" name="class_options" autocomplete="off">${mclass.name}</input>
            </label>
        `);
        if (active)
            button.addClass("active");
        button.click(() => {
            annotationTool.setMclass(mclass.name);
        });

        //Since we cannot set pseudo-selectors inline, we have to create CSS
        cssHelper.createCSSSelector(`#class_${mclass.name}`,`background-color: ${mclass.color};`);
        cssHelper.createCSSSelector(`#class_${mclass.name}:hover`,`background-color: ${active_color};`);
        cssHelper.createCSSSelector(`#class_${mclass.name}:active`,`background-color: ${active_color};`); //while pressed
        //Keep the select-box-shadow permanently (offset-x,offset-y,blur,width,color)
        cssHelper.createCSSSelector(`#class_${mclass.name}.active`,`background-color: ${mclass.color};box-shadow: 0 0 0.1rem .25rem rgba(0,0,0,0.5);`); //if enabled
        cssHelper.createCSSSelector(`#class_${mclass.name}:visited`,`background-color: ${active_color};`);
        cssHelper.createCSSSelector(`#class_${mclass.name}:focus`,`background-color: ${active_color};`);

        return button;
    }

    function _collaboratorListEntry(member, local, active, following) {
        const entry = $(`
            <a class="list-group-item list-group-item-action d-flex
            justify-content-between align-items-center" href="#">
                <span>
                    <span class="badge badge-pill" style="background-color: ${member.color};">
                        &nbsp;
                    </span>
                    &nbsp;&nbsp;&nbsp;
                    ${member.name}${local? " (you)" : following ? " (following)" : ""}
                </span>
                <span>
                    <input type="checkbox">
                </span>
            </a>
        `);
        const checkbox = entry.find("input");
        if (!active) {
            entry.addClass("disabled");
            checkbox.prop("disabled", true);
        }
        entry.click(event => {
            event.preventDefault();
            entry.closest(".modal").modal("hide");
            tmapp.moveTo(member.position);
        });
        checkbox.prop("checked", member.followed);
        checkbox.click(event => {
            event.stopPropagation();
            if (event.target.checked)
                collabClient.followView(member);
            else
                collabClient.stopFollowing();
        });
        return entry;
    }

    function _emptyImageBrowser() {
        return $(`
            <div class="col-12 text-center">
                <p class="m-4">No images were found on the server.</p>
            </div>
        `);
    }

    function _imageBrowserEntry(image) {
        const entry = $(`
            <div class="col-3 d-flex">
                <div class="card w-100">
                    <img src="${image.thumbnails.overview}" class="card-img-top position-absolute"
                    style="height: 130px; object-fit: cover;">
                    <img src="${image.thumbnails.detail}" class="card-img-top fade hide"
                    style="z-index: 9000; pointer-events: none; height: 130px; object-fit: cover;">
                    <div class="card-body text-center" style="padding:0" >
                        <a class="card-link stretched-link" href="?image=${image.name}">
                            ${image.name}
                        </a>
                    </div>
                </div>
            </div>
        `);
        const anchor = entry.find("a");
        const detail = entry.find("img:eq(1)");
        anchor.click(event => {
            event.preventDefault();
            entry.closest(".modal").modal("hide");
            collabClient.promptCollabSelection(image.name);
        });
        anchor.hover(
            () => detail.addClass("show").removeClass("hide"),
            () => detail.addClass("hide").removeClass("show")
        );
        return entry;
    }

    function _imageBrowserRow(images) {
        const row = $(`
            <div class="row mb-4">
            </div>
        `);
        images.forEach(image => row.append(_imageBrowserEntry(image)));
        return row;
    }

    /**
     * Fill a jquery selection with the nodes for editing an annotation.
     * @param {Object} container The selection that should contain the
     * annotation editing menu.
     * @param {annotationHandler.AnnotationPoint} annotation The annotation
     * that should be editable through the created menu.
     * @param {Function} saveFun The function that should be run when
     * pressing the save button in the menu.
     */
    function buildAnnotationSettingsMenu(container, annotation, saveFun) {
        const updateFun = saveFun;
        const id = _annotationValueRow("Id", annotation.id);
        const author = _annotationValueRow("Created by", annotation.author);
        const classes = _annotationMclassOptions(annotation, updateFun);
        const list = _annotationCommentList(annotation, updateFun);
        const input = _annotationCommentInput(body => {
            const comment = {
                author: userInfo.getName(),
                body: body
            };
            list.appendAnnotationComment(comment);
            annotation.comments.push(comment);
            updateFun();
        });
        container.append(id, author, classes, list, input);
    }

    /**
     * Fill a jquery selection with the nodes for selecting a class.
     * @param {Object} container The selection that should contain the
     * class selection buttons.
     * @param {number} activeIndex The index of the initially selected
     * class.
     */
    function buildClassSelectionButtons(container, activeIndex) {
        classUtils.forEachClass((mclass, index) => {
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
            const isFollowing = member.following === localMember.id;
            const entry = _collaboratorListEntry(member, isLocal, isActive, isFollowing);
            container.append(entry);
        });
    }

    /**
     * Fill a jquery selection with an image browser.
     * @param {Object} container The selection that should contain the
     * images.
     * @param {Array<Object>} images The images that should be browsable.
     */
    function buildImageBrowser(container, images) {
        if (images.length > 0) {
            let rowNumber = 0;
            while (rowNumber * 4 < images.length) {
                const start = rowNumber * 4;
                const end = start + 4;
                const rowContent = images.slice(start, end);
                const row = _imageBrowserRow(rowContent);
                container.append(row);
                rowNumber++;
            }
        }
        else {
            const message = _emptyImageBrowser();
            container.append(message);
        }
    }

    return {
        buildAnnotationSettingsMenu: buildAnnotationSettingsMenu,
        buildClassSelectionButtons: buildClassSelectionButtons,
        buildCollaboratorList: buildCollaboratorList,
        buildImageBrowser: buildImageBrowser
    };
})();

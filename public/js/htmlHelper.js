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

    function _annotationButtonRow(id, closeFun) {
        const row = $(`
                <div class="row mt-4">
                </div>
            `);
        const delCol = $(`
                <div class="col-6">
                    <a class="card-link" href="javascript:void(0);">
                        <svg class="mr-1" style="fill: currentColor;height: 1.3em;width: 1.3em;vertical-align: text-bottom" viewBox="0 0 23 23">
                            <path d="M 3 9 H 20 V 6 Q 20 5 19 5 H 4 Q 3 5 3 6 z M 4 10 H 19 V 20 Q 19 22 17 22 H 6 Q 4 22 4 20 z M 7 5 V 4.5 Q 7 2 9.5 2 H 13.5 Q 16 2 16 4.5 V 5 H 14 V 4.5 Q 14 4 13.5 4 H 9.5 Q 9 4 9 4.5 V 5 z"></path>
                        </svg>
                        Delete
                    </a>
                </div>
            `);
        const bookmarkCol = $(`
                <div class="col-6">
                    <a class="card-link" href="javascript:void(0);">
                        <svg class="mr-1" style="fill: currentColor;height: 1.3em;width: 1.3em;vertical-align: text-bottom" viewBox="0 0 23 23">
                            <path d="M 6 2 V 21 L 12 15 L 18 21 V 2 z"></path>
                        </svg>
                        Bookmark
                    </a>
                </div>
            `);
        delCol.find("a").click(() => {
            closeFun();
            annotationHandler.remove(id);
        });
        bookmarkCol.find("a").click(() => {
            annotationHandler.bookmark(id);
        });
        row.append(delCol, bookmarkCol);
        return row;
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

    function _commentAlt(comment, removeFun) {
        const entry = $(`
            <li class="list-group-item">
                <p class="text-break comment_body" style="white-space: pre-line"></p>
                <div class="small d-flex justify-content-between">
                    <span class="text-muted">
                        Added by <span class="comment_author"></span>
                    </span>
                    <a href="#">
                        Remove
                    </a>
                </div>
            </li>
        `);
        entry.find(".comment_body").text(comment.content);
        entry.find(".comment_author").text(comment.author);
        const removeBtn = entry.find("a");
        removeBtn.click(() => removeFun(comment.id));
        return entry;
    }

    function _comment(comment, removeFun) {
        const entry = $(`
            <li class="list-group-item">
                <p class="text-break comment_body" style="white-space: pre-line"></p>
                <div class="small d-flex justify-content-between">
                    <span class="text-muted">
                        Added by <span class="comment_author"></span>
                    </span>
                    <a href="#">
                        Remove
                    </a>
                </div>
            </li>
        `);
        entry.find(".comment_body").text(comment.body);
        entry.find(".comment_author").text(comment.author);
        const removeBtn = entry.find("a");
        removeBtn.click(removeFun);
        return entry;
    }

    function _commentListAlt() {
        const container = $(`
            <div class="card bg-secondary mb-2" style="height: 15vh; overflow-y: auto; resize: vertical;">
                <ul class="list-group list-group-flush position-absolute w-100">
                </ul>
            </div>
        `);
        return container;
    }

    function _addFunctionalityToCommentList(listContainer, removeFun) {
        const list = listContainer.find("ul");
        let stuckToBottom = false;
        const updateComments = (comments => {
            const shouldStickToBottom = stuckToBottom;
            list.empty();
            comments.forEach(comment => {
                const entry = _commentAlt(comment, removeFun);
                list.append(entry);
            });
            if (shouldStickToBottom) {
                listContainer.scrollTop(list.height() - listContainer.height());
            }
        });
        const stickState = (state => {
            const hasHeight = listContainer.height() !== 0 && list.height() !== 0;
            const fitsInContainer = listContainer.height() > list.height();
            const atBottom = list.height() - (listContainer.height() + listContainer.scrollTop()) < 20;
            if (hasHeight && (fitsInContainer || atBottom)) {
                stuckToBottom = true;
            }
            else if (state !== undefined) {
                stuckToBottom = state;
            }
            return stuckToBottom;
        });
        const commentSection = new CommentSection(stickState, updateComments);
        const tryStickingToBottom = () => {
            const distToBottom = list.height() - (listContainer.height() + listContainer.scrollTop());
            stuckToBottom = distToBottom < 20;
            if (stuckToBottom) {
                commentSection.allCommentsInView();
            }
        };
        listContainer.scroll(tryStickingToBottom);
        const heightObserver = new MutationObserver(tryStickingToBottom);
        heightObserver.observe(listContainer.get(0), {
            attributes: true,
            attributeFilter: ["style"]
        });
        return commentSection;
    }

    function _commentList(commentable, updateFun) {
        if (!commentable.comments)
            commentable.comments = [];
        const comments = commentable.comments;

        const container = $(`
            <div class="card bg-secondary mb-2" style="height: 15vh; overflow-y: auto;">
                <ul class="list-group list-group-flush">
                </ul>
            </div>
        `);
        container.appendComment = comment => {
            const entry = _comment(comment, event => {
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
        comments.forEach(container.appendComment);
        return container;
    }

    function _commentInputAlt(inputFun) {
        const container = $(`
            <div class="input-group">
                <textarea class="form-control" rows="1" style="resize: vertical;"></textarea>
                <div class="input-group-append">
                    <button type="button" class="btn btn-primary">Add comment</button>
                </div>
            </div>
        `);
        const submitButton = container.find("button");
        submitButton.click(() => {
            const textarea = container.find("textarea");
            const body = textarea.val();
	    if (body.length > 0) {
                textarea.val("");
                inputFun(body);
            }
        });
        container.keypress(e => e.stopPropagation());
        container.keyup(e => e.stopPropagation());
        container.keydown(e => {
            e.stopPropagation();
            if ((e.code === "Enter" || e.code === "NumpadEnter") && !e.shiftKey) {
                e.preventDefault();
		submitButton.click();
            }
            else if (e.code === "Escape") {
                $("#main_content").focus();
            }
        });
        return container;
    }

    function _commentInput(inputFun) {
        const container = $(`
            <div class="input-group">
                <textarea class="form-control" rows="1" style="resize: none;"></textarea>
                <div class="input-group-append">
                    <button type="button" class="btn btn-primary">Add comment</button>
                </div>
            </div>
        `);
	 const submitButton = container.find("button");
        submitButton.click(() => {
            const textarea = container.find("textarea");
            const body = textarea.val();
            textarea.val("");
            inputFun(body);
        });
        container.keypress(e => e.stopPropagation());
        container.keyup(e => e.stopPropagation());
        container.keydown(e => {
            e.stopPropagation();
            if ((e.code === "Enter" || e.code === "NumpadEnter") && !e.shiftKey) {
                e.preventDefault();
		submitButton.click();
            }
            else if (e.code === "Escape") {
                container.parent().parent().focus();
            }
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
                <span class="badge badge-light mt-1 d-block" id="class_counter_${mclass.name}">0</span>
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
                    ${member.name}${local? " (me)" : following ? " (following)" : ""}
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
     * Fill a jquery selection with a comment section.
     * @param {Object} container The selection that should contain the
     * comment section.
     * @param {Object} commentable The object that will store the
     * comments. The comments will be added to an array in the `comments`
     * field of the object, which will be created if no such field
     * already exists.
     * @param {Object} updateFun The function that should be run when
     * pressing the save button in the menu.
     */
    function buildCommentSection(container, commentable, updateFun) {
        const list = _commentList(commentable, updateFun);
        const input = _commentInput(body => {
            const comment = {
                author: userInfo.getName(),
                body: body
            };
            list.appendComment(comment);
            commentable.comments.push(comment);
            updateFun();
        });
        container.append(list, input);
    }

    /**
     * Fill a jquery selection with a comment section.
     * @param {Object} container The selection that should contain the
     * comment section.
     * @param {Function} inputFun The function to which the comment text
     * should be passed when the submit button is pressed.
     * @param {Function} removeFun The function to which the comment id
     * should be passed when the remove button is pressed.
     * @returns {CommentSection} CommentSection object that can be used
     * to interface with the comment section HTML.
     */
    function buildCommentSectionAlt(container, inputFun, removeFun) {
        // TODO: Change the other comment section to use this
        const listContainer = _commentListAlt();
        const commentSection = _addFunctionalityToCommentList(listContainer, removeFun);
        const input = _commentInputAlt(inputFun);
        container.append(listContainer, input);
        return commentSection;
    }

    /**
     * Fill a jquery selection with the nodes for editing an annotation.
     * @param {Object} container The selection that should contain the
     * annotation editing menu.
     * @param {annotationHandler.AnnotationPoint} annotation The annotation
     * that should be editable through the created menu.
     * @param {Function} closeFun A function that can be called to close
     * the annotation menu.
     * @param {Function} saveFun The function that should be run when
     * pressing the save button in the menu.
     */
    function buildAnnotationSettingsMenu(container, annotation, closeFun, saveFun) {
        const updateFun = saveFun;
        const id = _annotationValueRow("Id", annotation.id);
        const author = _annotationValueRow("Created by", annotation.author);
        const classes = _annotationMclassOptions(annotation, updateFun);
        const list = _commentList(annotation, updateFun);
        const input = _commentInput(body => {
            const comment = {
                author: userInfo.getName(),
                body: body
            };
            list.appendComment(comment);
            annotation.comments.push(comment);
            updateFun();
        });
        const buttonRow = _annotationButtonRow(annotation.id, closeFun);
        container.append(id, author, classes, list, input, buttonRow);
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
        buildCommentSection: buildCommentSection,
        buildCommentSectionAlt: buildCommentSectionAlt,
        buildAnnotationSettingsMenu: buildAnnotationSettingsMenu,
        buildClassSelectionButtons: buildClassSelectionButtons,
        buildCollaboratorList: buildCollaboratorList,
        buildImageBrowser: buildImageBrowser
    };
})();

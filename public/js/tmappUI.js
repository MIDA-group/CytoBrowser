/**
 * Interface for programatically interacting with the HTML elements not
 * connected to OpenSeadragon. Putting these functions here keeps
 * things in the same place and removes clutter from other namespaces.
 * The initUI() function should be called initially to add the elements
 * that need to be added programatically.
 * @namespace tmappUI
 */
const tmappUI = (function(){
    "use strict";

    let _pageInFocus = true,
        _errorDisplayTimeout = null;

    const _errors = {
        noimage: {
            message: "No image has been specified. Select one from the menu on the right.",
            type: "alert-info"
        },
        badimage: {
            message: "The specified image was not found. Select a new one from the menu on the right.",
            type: "alert-warning"
        },
        servererror: {
            message: "Something went wrong on the server. Try again or contact an administrator.",
            type: "alert-warning"
        },
        unexpected: {
            message: "An unexpected error was encountered when retrieving the image list.",
            type: "alert-warning"
        },
        tilefail: {
            message: "Failed to load image tile from server.",
            type: "alert-danger"
        }
    };

    function _openContextMenu(title, location, buildFun) {
        $("#context_menu_title").text(title);
        const menu = $("#context_menu");
        const body = menu.find(".card-body");
        body.empty();
        buildFun(body);

        const maxBottom = menu.height() + location.y;
        const maxRight = menu.width() + location.x;
        const winh = $(window).height();
        const winw = $(window).width();
        const top = maxBottom < winh ? location.y : Math.max(15, location.y - menu.height());
        const left = maxRight < winw ? location.x : location.x - menu.width();
        menu.css({top: top, left: left, pointerEvents: "auto"});

        _pageInFocus = false;
        menu.addClass("show");
        menu.focus();
    }

    function _closeContextMenu() {
        const menu = $("#context_menu");
        if (menu.hasClass("show")) {
            setTimeout(() => _pageInFocus = true, 100);
            menu.removeClass("show");
            menu.css({pointerEvents: "none"});
            $("#main_content").focus();
        }
    }

    function _initClassSelectionButtons() {
        const initialMclass = classUtils.getClassFromID(0);
        annotationTool.setMclass(initialMclass.name);
        const container = $("#class_buttons");
        htmlHelper.buildClassSelectionButtons(container, 0);
    }

    function _initToolSelectionButtons() {
        $("#tool_marker").addClass("active");
        overlayHandler.setActiveAnnotationOverlay("marker");
        annotationTool.setTool("marker");
        $("#tool_marker").click(() => {
            overlayHandler.setActiveAnnotationOverlay("marker");
            annotationTool.setTool("marker");
        });
        $("#tool_rect").click(() => {
            overlayHandler.setActiveAnnotationOverlay("region");
            annotationTool.setTool("rect");
        });
        $("#tool_poly").click(() => {
            overlayHandler.setActiveAnnotationOverlay("region");
            annotationTool.setTool("poly");
        });
    }

    function _initViewerEvents() {
        $("#ISS_viewer").bind("mousewheel DOMMouseScroll", event => {
            event.preventDefault();
        });
        $("#ISS_viewer").contextmenu(() => false);
    }

    function _initContextMenu() {
        const menu = $("#context_menu");
        menu.focusout(event => {
            const isSame = menu.get(0) === event.relatedTarget;
            const isInside = $.contains(menu.get(0), event.relatedTarget);
            if (!isSame && !isInside)
                _closeContextMenu();
        });
        menu.contextmenu(() => false);
        const close = $("#close_context_menu");
        close.click(_closeContextMenu);
    }

    function _initDocumentFocusFunctionality() {
        $(document).focus(() => {
            // A small delay since this seems to fire before any other handlers
            // TODO: Find a cleaner way for clicks to check for focus
            setTimeout(() => _pageInFocus = true, 100);
        });
        $(document).blur(() => {
            _pageInFocus = false;
        });
    }

    function _initStorageButtonEvents() {
        $("#json_to_data").click(() => {
            $("#data_files_import").click();
        });
        $("#data_files_import").change(event => {
            if (event.target.files.length) {
                const loadedJSON = localStorage.loadJSON("data_files_import");
                loadedJSON.then(annotationStorageConversion.addAnnotationStorageData);
            }
        });
        $("#points_to_json").click(() => {
            const annotationData = annotationStorageConversion.getAnnotationStorageData();
            localStorage.saveJSON(annotationData);
        });
    }

    function _initFocusButtonEvents() {
        $("#focus_next").click(tmapp.incrementFocus);
        $("#focus_prev").click(tmapp.decrementFocus);
    }

    function _initKeyboardShortcuts() {
        // Shortcuts for the context menu
        $("#context_menu").keydown(function(){
            switch(event.keyCode) {
                case 27: // esc
                    _closeContextMenu();
                    break;
            }
        });

        //1,2,... for class selection
        //z,x for focus up down
        $("#main_content").keydown(function(){
            let caught=true; //Assume we use the key (setting to false in 'default')
            switch(event.keyCode) {
                case 27: // esc
                    annotationTool.reset();
                    break;
                case 8: // backspace
                    annotationTool.revert();
                    break;
                case 13: // enter
                    annotationTool.complete();
                    break;
                // ASDF...
                case 70: // f
                    //catching 'f' to disable 'Flip' in OSD, we do not support it
                    break;
                // ZXCV...
                case 90: // z
                    $("#focus_prev").click();
                    break;
                case 88: // x
                    $("#focus_next").click();
                    break;
                case 67: // c
                    $("#tool_marker").click();
                    break;
                case 86: // v
                    $("#tool_rect").click();
                    break;
                case 66: // b
                    $("#tool_poly").click();
                    break;
                default:
                    caught=false; //Assume we miss the key
                    // Handle digit keys being pressed for classes
                    const digits = Array.from({length: 10}, (v, k) => String((k+1) % 10));
                    const chars = digits.map(digit => digit.charCodeAt());
                    chars.slice(0, classUtils.count()).forEach((char, index) => {
                        if (event.which === char) {
                            $("#class_" + classUtils.getClassFromID(index).name).click();
                            caught=true; //We did take it
                        }
                    });
            }
            if (caught) {
                event.preventDefault(); //prevent e.g. Firefox to open search box
            }
        });
    }

    function _initCollaborationMenu() {
        function setName() {
            const name = $("#collaboration_start [name='username']").val();
            collabClient.changeName(name);
        }

        let nameTimeout;
        const keyUpTime = 3000;
        const defaultName = userInfo.getName();
        $("#collaboration_menu").on("hide.bs.modal", setName);
        $("#collaboration_start [name='username']").val(defaultName || "");
        $("#collaboration_start [name='username']").keyup(function(event) {
            clearTimeout(nameTimeout);
            nameTimeout = setTimeout(setName, keyUpTime);
        });
        $("#create_collaboration").click(function(event) {
            const name = $("#collaboration_start [name='username']").val();
            const include = $("#include_points").prop("checked");
            collabClient.createCollab(name, include);
        });
        $("#join_collaboration").click(function(event) {
            const name = $("#collaboration_start [name='username']").val();
            const id = $("#collaboration_start [name='joined_id']").val();
            const include = $("#include_points").prop("checked");
            $("#collaboration_menu").modal("hide");
            collabClient.connect(id, name, include);
        });
        $("#copy_collaboration").click(function(event) {
            $("#collaboration_start [name='collab_url']").select();
            document.execCommand("copy");
        });
        $("#leave_collaboration").click(function(event) {
            collabClient.disconnect();
        });
    }

    /**
     * Initialize UI components that need to be added programatically
     * and add any event handlers that are needed.
     */
    function initUI() {
        _initClassSelectionButtons();
        _initToolSelectionButtons();
        _initViewerEvents();
        _initContextMenu();
        _initDocumentFocusFunctionality();
        _initStorageButtonEvents();
        _initFocusButtonEvents();
        _initKeyboardShortcuts();
        _initCollaborationMenu();
        fileBrowserUI.init();
    }

    /**
     * Open a popup modal for a general multiple-choice event. If a
     * modal is currently opened, it will be closed and reopened
     * once the choice has been made or the choice modal has been closed.
     * @param {string} title The title to display in the modal.
     * @param {Array<Object>} choices An array of choices that can be
     * chosen from. Each choice should contain a label property and
     * a click property to properly display and handle their buttons.
     * @param {Function} onCancel Function to call if the modal is closed.
     */
    function choice(title, choices, onCancel) {
        const activeModal = $(".modal.show");
        activeModal.modal("hide");
        $("#multiple_choice .modal-title").text(title);
        $("#choice_list").empty();
        choices.forEach(choice => {
            const choiceButton = $(`<button class="btn btn-primary btn-block">
                ${choice.label}
            </button>`);
            choiceButton.click(choice.click);
            choiceButton.click(() => $("#multiple_choice").modal("hide"));
            $("#choice_list").append(choiceButton);
        });
        const cancelButton = $(`<button class="btn btn-secondary btn-block">
            Cancel
        </button>`);
        cancelButton.click(() => $("#multiple_choice").modal("hide"));
        $("#choice_list").append(cancelButton);
        $("#multiple_choice").modal("show");
        $("#multiple_choice").one("hide.bs.modal", () => activeModal.modal("show"));
        $("#multiple_choice").one("hidden.bs.modal", $("#choice_list").empty);
        onCancel && $("#multiple_choice").one("hidden.bs.modal", onCancel);
    }

    /**
     * Open a menu at the mouse cursor for editing comments for
     * a given annotation.
     * @param {number} id The id of the edited annotation.
     * @param {Object} location The location of the upper left corner of
     * the menu being opened.
     * @param {number} location.x The x coordinate in page coordinates.
     * @param {number} location.y The y coordinate in page coordinates.
     */
    function openAnnotationEditMenu(id, location) {
        const annotation = annotationHandler.getAnnotationById(id);
        if (!annotation) {
            throw new Error("Invalid annotation id.");
        }

        _openContextMenu("Edit annotation", location, menuBody => {
            htmlHelper.buildAnnotationSettingsMenu(menuBody, annotation, () => {
                annotationHandler.update(id, annotation, "image");
            });
        });
    }

    /**
     * Set the ID of the current collaboration so it can be displayed,
     * disable the elements for creating and joining collaborations, and
     * enable the button for leaving the collaboration.
     * @param {string} id Identifier for the active collaboration.
     */
    function setCollabID(id) {
        const collabUrl = new URL(window.location.href.split('?')[0]);
        collabUrl.searchParams.set("collab", id);
        $("#collaboration_start [name='collab_url']").val(collabUrl.href);
        $("#collaboration_start [name='active_id']").val(id);
        $("#collaboration_start input, #collaboration_start button").prop("disabled", true);
        $("#collaboration_start [name='username']").prop("disabled", false);
        $("#collaboration_start [name='collab_url']").prop("disabled", false);
        $("#copy_collaboration").prop("disabled", false);
        $("#leave_collaboration").prop("disabled", false);
    }

    /**
     * Clear the information about the ongoing collaboration,
     * reenable the buttons for joining and creating collaborations, and
     * disable the button for leaving the collaboration.
     */
    function clearCollabID() {
        $("#collaboration_start [name='collab_url']").val("");
        $("#collaboration_start [name='active_id']").val("");
        $("#collaboration_start input, #collaboration_start button").prop("disabled", false);
        $("#collaboration_start [name='username']").prop("disabled", false);
        $("#collaboration_start [name='collab_url']").prop("disabled", true);
        $("#copy_collaboration").prop("disabled", true);
        $("#leave_collaboration").prop("disabled", true);
    }

    /**
     * Update the list of collaborators and add the appropriate event
     * handlers.
     * @param {Object} localMember Object for the local member.
     * @param {Array} members Array of currently collaborating members.
     */
    function updateCollaborators(localMember, members) {
        const list = $("#collaborator_list");
        list.empty();
        htmlHelper.buildCollaboratorList(list, localMember, members);
    }

    /**
     * Clear the list of collaborators.
     */
    function clearCollaborators() {
        updateCollaborators({}, []);
    }

    /**
     * Enable the collaboration creation functionality.
     */
    function enableCollabCreation() {
        $("#create_collaboration").prop("disabled", false);
    }

    /**
     * Display an error message over the image viewport.
     * @param {string} error The type of error taking place. The possible
     * error types are "noimage", "badimage", "servererror", "unexpected",
     * and "tilefail". If none of these are specified, this argument is
     * instead used for the error message itself.
     * @param {number} duration How long the message should be displayed
     * before fading out. If falsy, the message will remain forever.
     */
    function displayImageError(error, duration) {
        const errorInfo = _errors[error] || {message: error, type: "alert-info"};

        // Add alert to the UI
        const alert = $("<div></div>");
        alert.addClass(`alert ${errorInfo.type}`);
        alert.text(errorInfo.message);
        window.clearTimeout(_errorDisplayTimeout);
        $("#ISS_viewer").addClass("blurred");
        $("#alert_wrapper").removeClass("fade out");
        $("#alert_wrapper").html(alert);

        // Fade out the alert after the duration has passed
        if (duration) {
            _errorDisplayTimeout = window.setTimeout(clearImageError, duration);
        }
    }

    /**
     * Fade out the currently displayed image error.
     */
    function clearImageError() {
        $("#ISS_viewer").removeClass("blurred");
        $("#alert_wrapper").addClass("fade out");
    }

    /**
     * Representation of a selectable image.
     * @typedef {Object} ImageDetails
     * @property {string} name Name of the image.
     * @property {Object} thumbnails Thumbnails for image preview.
     * @property {string} thumbnails.overview Address to a tile
     * with a zoomed-out view of the image.
     * @property {string} thumbnails.detail Address to a tile with
     * a zoomed-out detail view of the image.
     */
    /**
     * Add image selection elements to the image browser.
     * @param {Array<ImageDetails>} images Information about the images
     * being added.
     */
    function updateImageBrowser(images) {
        const container = $("#available_images");
        htmlHelper.buildImageBrowser(container, images);
    }

    /**
     * Set the displayed user name in the UI.
     * @param {string} txt The username to display.
     */
    function setUserName(txt) {
        $("#user_name").text(txt || txt === 0 ? txt : "-");
    }

    /**
     * Set the displayed image name in the UI.
     * @param {string} txt The image name to display.
     */
    function setImageName(txt) {
        $("#img_name").text(txt || txt === 0 ? txt : "-");
    }

    /**
     * Set the displayed z level in the UI.
     * @param {string} txt The z level to display.
     */
    function setImageZLevel(txt) {
        $("#img_zlevel").text(txt || txt === 0 ? txt : "-");
    }

    /**
     * Set the displayed zoom in the UI.
     * @param {string} txt The zoom value to display.
     */
    function setImageZoom(txt) {
        $("#img_zoom").text(txt || txt === 0 ? txt : "-");
    }

    /**
     * Set the displayed rotation in the UI.
     * @param {string} txt The rotation value to display.
     */
    function setImageRotation(txt) {
        $("#img_rotation").text(txt || txt === 0 ? `${txt}°` : "-");
    }

    /**
     * Push a new state to the URL.
     * @param {string} txt The new state to push.
     */
    function setURL(txt) {
        window.history.pushState(null, "", txt);
    }

    /**
     * Check whether or not the page is in focus.
     * @returns {boolean} Whether or not the page is in focus.
     */
    function inFocus() {
        return _pageInFocus;
    }

    return {
        initUI: initUI,
        choice: choice,
        openAnnotationEditMenu: openAnnotationEditMenu,
        setCollabID: setCollabID,
        clearCollabID: clearCollabID,
        updateCollaborators: updateCollaborators,
        clearCollaborators: clearCollaborators,
        enableCollabCreation: enableCollabCreation,
        displayImageError: displayImageError,
        clearImageError: clearImageError,
        updateImageBrowser: updateImageBrowser,
        setUserName: setUserName,
        setImageName: setImageName,
        setImageZLevel: setImageZLevel,
        setImageZoom: setImageZoom,
        setImageRotation: setImageRotation,
        setURL: setURL,
        inFocus: inFocus
    };
})();

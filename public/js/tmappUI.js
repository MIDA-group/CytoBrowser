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
        missingdatadir: {
            message: "The server has been set up to look for images in a " +
            "directory that does not exist. Make sure the directory exists " +
            "or select a different directory.",
            type: "alert-warning"
        },
        noimage: {
            message: "No image has been specified. Select one from the " +
            "image browser.",
            type: "alert-info"
        },
        noavailableimages: {
            message: "The server was not able to find any images in the " +
            "data directory. Make sure it's populated and try again.",
            type: "alert-info"
        },
        badimage: {
            message: "The specified image was not found. Select a new one " +
            "from the menu on the right.",
            type: "alert-warning"
        },
        servererror: {
            message: "Something went wrong on the server. Try again or " +
            "contact an administrator.",
            type: "alert-warning"
        },
        unexpected: {
            message: "An unexpected error was encountered when retrieving " +
            "the image list.",
            type: "alert-warning"
        },
        tilefail: {
            message: "Failed to load image tile from server.",
            type: "alert-danger"
        },
        loadingcollab: {
            message: "Connecting to the session, please wait.",
            type: "alert-info"
        },
        waitingapi: {
            message: "Waiting for server response...",
            type: "alert-info"
        }
    };

    function _openContextMenu(title, location, buildFun) {
        $("#context_menu_title").text(title);
        const menu = $("#context_menu");
        const body = menu.find(".card-body");
        body.empty();
        buildFun(body, _closeContextMenu);

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

    function _initAnnotationList() {
        const list = new SortableList("#annotation-list", "#rtoolbar", "id", [
            {
                name: "x",
                key: "x",
                minWidth: "5em",
                selectFun: d => Math.round(d.centroid.x),
                sortable: true
            },
            {
                name: "y",
                key: "y",
                minWidth: "5em",
                selectFun: d => Math.round(d.centroid.y),
                sortable: true
            },
            {
                name: "z",
                key: "z",
                minWidth: "3em",
                selectFun: d => d.z,
                sortable: true
            },
            {
                name: "Class",
                key: "mclassId",
                selectFun: d => classUtils.getIDFromName(d.mclass),
                minWidth: "5em",
                displayFun: (elem, d) => {
                    const color = classUtils.classColor(d.mclassId);
                    const name = classUtils.getClassFromID(d.mclassId).name;
                    const badge = $("<span></span>");
                    badge.text(name);
                    badge.addClass("badge text-white");
                    badge.css("background-color", color);
                    $(elem).html(badge);
                },
                sortable: true
            },
            {
                name: "Pred.",
                key: "prediction",
                title: "Class prediction score",
                minWidth: "6em",
                displayFun: (elem, d) => {
                    $(elem).html((d.prediction == null) ? "&nbsp;" : d.prediction.toFixed(4));
                },
                sortable: true
            },
            {
                name: "B",
                key: "bookmarked",
                title: "Annotation has been bookmarked",
                minWidth: "2em",
                displayFun: (elem, d) => {
                    $(elem).html(d.bookmarked ? "&check;" : "-");
                },
                sortable: true
            },
            {
                name: "R",
                key: "isARegion",
                title: "Annotation is a region",
                minWidth: "2em",
                selectFun: d => d.points.length > 1,
                displayFun: (elem, d) => {
                    $(elem).html(d.isARegion ? "&check;" : "-");
                },
                sortable: true
            },
            {
                name: "C",
                key: "nComments",
                title: "Number of comments",
                minWidth: "2em",
                selectFun: d => (d.comments && d.comments.length) || 0,
                sortable: true
            }   
        ],
        null, 
        null, 
        {
            'href':(d)=>tmapp.annotationURL(d.id),
            'onclick':(d)=>{event.preventDefault();tmapp.moveToAnnotation(d.id);}
        }
        );

        annotationVisuals.setAnnotationList(list);
    }

    function _initCollabPicker() {
        collabPicker.init();
    }

    function _initVersionPicker() {
        versionRevert.init();
    }

    function _initGlobalComments() {
        const container = $("#global_comments");
        const inputFun = globalDataHandler.sendCommentToServer;
        const removeFun = globalDataHandler.sendCommentRemovalToServer;
        const commentSection = htmlHelper.buildCommentSectionAlt(container, inputFun, removeFun);
        const updateFun = comments => commentSection.updateComments(comments);
        const originalTitle = document.title;
        commentSection.onChangeUnseen(unseenIds => {
            const nUnseen = unseenIds.length;
            if (nUnseen > 0) {
                $("#unseen_comments").text(nUnseen);
                $("#unseen_comments").show();
                const notificationTitle = `(${nUnseen}) ${originalTitle}`;
                document.title = notificationTitle;
            }
            else {
                $("#unseen_comments").hide();
                document.title = originalTitle;
            }
        });
        let commentsVisible = false;
        $("#comments_collapse").on("shown.bs.collapse", () => {
            commentSection.setVisibility(true);
            commentsVisible = true;
        });
        $("#comments_collapse").on("hidden.bs.collapse", () => {
            commentSection.setVisibility(false);
            commentsVisible = false;
        });
        $(document).focus(() => {
            commentSection.setVisibility(commentsVisible);
        });
        $(document).blur(() => {
            commentSection.setVisibility(false);
        });
        globalDataHandler.setCommentUpdateFun(updateFun);
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
            if (!isSame && !isInside) {
                _closeContextMenu();
            }
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

    function _initAnnotationFiltering() {
        let keyUpTimeout = null;
        const keyUpTime = 3000;
        const input = $("#filter-query-input");
        const initialQuery = input.val();
        annotationVisuals.setFilterQueryWithoutUpdating(initialQuery);
        function updateQuery() {
            const query = input.val();
            annotationVisuals.setFilterQuery(query);
        }
        input.keypress(e => e.stopPropagation());
        input.keyup(e => {
            e.stopPropagation();
            clearTimeout(keyUpTimeout);
            keyUpTimeout = setTimeout(updateQuery, keyUpTime);
        });
        input.keydown(e => {
            e.stopPropagation();
            if (e.code === "Escape" || e.code === "Enter" || e.code === "NumpadEnter") {
                updateQuery();
            }
        });
    }

    function _initFocusButtonEvents() {
        $("#focus_next").click(tmapp.incrementFocus);
        $("#focus_prev").click(tmapp.decrementFocus);
    }

    function _initVisualizationSliders() {
        $("#brightness_slider").slider().on('change', function(e) {tmapp.setBrightness(e.value.newValue);});
        $("#contrast_slider").slider().on('change', function(e) {tmapp.setContrast(e.value.newValue);});
        $("#brightness_reset").click(function() { $('#brightness_slider').slider('setValue', 0, true, true);});
        $("#contrast_reset").click(function() { $('#contrast_slider').slider('setValue', 0, true, true);});
    }

    function _initKeyboardShortcuts() {
        // Shortcuts for the pop-up context menu
        $("#context_menu").keydown(function(){
            switch(event.which) {
                case 27: // esc
                    _closeContextMenu();
                    break;
            }
        });

        // Propagate keypress events to OSD (also when not focused)
        $("#main_content").keypress(function(){
            tmapp.keyHandler(event);
        });

        //1,2,... for class selection
        //z,x for focus up down
        $("#main_content").keydown(function(){
            // Prevent the keyboard shortcuts from being used when the ctrl key is down
            // This is just a simple way of letting people copy and paste, could be refined
            if (event.ctrlKey) {
                return;
            }
            let caught=true; //Assume we use the key (setting to false in 'default')
            switch(event.which) {
                case 27: // esc
                    annotationTool.reset();
                    regionEditor.stopEditingRegion();
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
                        if (event.which === char || event.which === char+48) {
                            $("#class_" + classUtils.getClassFromID(index).name).click();
                            caught=true; //We did take it
                        }
                    });
            }
            if (caught) {
                event.preventDefault(); //prevent e.g. Firefox to open search box
            }
            else {
                tmapp.keyDownHandler(event); //Send events on to OSD (also if not in focus)
            }
        });
    }

    function _initCollaborationMenu() {
        function setUsernameField() {
            const name = $("#collaboration_start [name='username']").val();
            collabClient.changeUsername(name);
        }
        function setCollabNameField() {
            const name = $("#collaboration_start [name='collab_name']").val();
            collabClient.changeCollabName(name);
        }

        let usernameTimeout;
        let collabNameTimeout;
        const keyUpTime = 3000;
        const defaultName = userInfo.getName();
        $("#collaboration_menu").on("hide.bs.modal", () => {
            setUsernameField();
            setCollabNameField();
        });
        $("#collaboration_start [name='username']").val(defaultName || "");
        $("#collaboration_start [name='username']").keyup(function(event) {
            clearTimeout(usernameTimeout);
            usernameTimeout = setTimeout(setUsernameField, keyUpTime);
        });
        $("#collaboration_start [name='collab_name']").val("");
        $("#collaboration_start [name='collab_name']").keyup(function(event) {
            clearTimeout(collabNameTimeout);
            collabNameTimeout = setTimeout(setCollabNameField, keyUpTime);
        });
        $("#copy_collaboration").click(function(event) {
            $("#collaboration_start [name='collab_url']").select();
            document.execCommand("copy");
        });
        $("#change_session").click(function(event) {
            const image = tmapp.getImageName();
            collabPicker.open(image,false,false);
        });
    }

    /**
     * Initialize UI components that need to be added programatically
     * and add any event handlers that are needed.
     */
    function initUI() {
        _initAnnotationList();
        _initCollabPicker();
        _initVersionPicker();
        _initGlobalComments();
        _initClassSelectionButtons();
        _initToolSelectionButtons();
        _initViewerEvents();
        _initContextMenu();
        _initDocumentFocusFunctionality();
        _initStorageButtonEvents();
        _initAnnotationFiltering();
        _initFocusButtonEvents();
        _initVisualizationSliders();
        _initKeyboardShortcuts();
        _initCollaborationMenu();
    }

    /**
     * Updates the class selection buttons to reflect changes in the classification system.
     * @param {Object} classConfig
     */
    function updateClassSelectionButtons() {
        _initClassSelectionButtons();
    }

    /**
     * Open a popup modal for a general multiple-choice event. If a
     * modal is currently opened, it will be closed and reopened
     * once the choice has been made or the choice modal has been closed.
     * @param {string} title The title to display in the modal.
     * @param {string} html HTML text for a div before the list of choices.
     * @param {Array<Object>} choices An array of choices that can be
     * chosen from. Each choice should contain a label property and
     * a click property to properly display and handle their buttons.
     * Can also include a truthy highlight property to set as different
     * color than normal choices.
     * @param {Function} onCancel Function to call if the modal is closed.
     * @param {boolean} forceChoice Whether or not the choice has to be
     * made.
     */
    function choice(title, html, choices, onCancel, forceChoice=false) {
        const activeModal = $(".modal.show");
        activeModal.modal("hide");
        
        //https://stackoverflow.com/questions/34440464/bootstrap-modal-backdrop-static-not-working/
        $("#multiple_choice").data('bs.modal',null); // clear the BS modal data so that we can change settings
        $("#multiple_choice .modal-title").text(title);
        $("#multiple_choice #modal_text").html(html);
        $("#multiple_choice #choice_list").empty();

        choices.forEach(choice => {
            const choiceButton = $(`<button class="btn btn-${choice.highlight ? "dark" : "primary"} btn-block">
                ${choice.label}
            </button>`);
            //To avoid problems with switching from modal to another, wait for hidden first
            choiceButton.click(() => $("#multiple_choice").one('hidden.bs.modal', choice.click));
            choiceButton.click(() => $("#multiple_choice").modal("hide"));
            $("#choice_list").append(choiceButton);
        });
        if (!forceChoice) {
            $("#multiple_choice #exit_button").show();

            const cancelButton = $(`<button class="btn btn-secondary btn-block">
                Cancel
            </button>`);
            cancelButton.click(() => $("#multiple_choice").modal("hide"));
            $("#multiple_choice #choice_list").append(cancelButton);
            $("#multiple_choice").modal();
        }
        else {
            $("#multiple_choice #exit_button").hide();
            $("#multiple_choice").modal({backdrop: "static", keyboard: false});
        }
        $("#multiple_choice").one("hide.bs.modal", () => activeModal.modal("show"));
        $("#multiple_choice").one("hidden.bs.modal", $("#multiple_choice #choice_list").empty);
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

        _openContextMenu("Edit annotation", location, (menuBody, closeFun) => {
            htmlHelper.buildAnnotationSettingsMenu(menuBody, annotation, closeFun, () => {
                annotationHandler.update(id, annotation, "image");
            });
        });
    }

    /**
     * Set the ID of the current collaboration so it can be displayed,
     * disable the elements for creating and joining collaborations, and
     * enable the button for leaving the collaboration.
     * @param {string} id Identifier for the active collaboration.
     * @param {string} image Name of the image the collab is for.
     */
    function setCollabID(id, image) {
        const collabUrl = new URL(window.location.href.split('?')[0]);
        collabUrl.searchParams.set("collab", id);
        collabUrl.searchParams.set("image", image)
        $("#collaboration_start [name='collab_url']").val(collabUrl.href);
        $("#collaboration_start [name='active_id']").val(id);
        $("#collaboration_start input, #collaboration_start button").prop("disabled", true);
        $("#collaboration_start [name='username']").prop("disabled", false);
        $("#collaboration_start [name='collab_name']").prop("disabled", false);
        $("#collaboration_start [name='collab_url']").prop("disabled", false);
        $("#copy_collaboration").prop("disabled", false);
        $("#leave_collaboration").prop("disabled", false);
        $("#change_session").prop("disabled", false);
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
        $("#change_session").prop("disabled", true);
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
     * Set the displayed collab name in the UI.
     * @param {string} txt The collab name to display.
     */
    function setCollabName(txt) {
        $("#collaboration_start [name='collab_name']").val(txt || txt === 0 ? txt : "");
        $("#collab_name").text(txt || txt === 0 ? txt : "-");
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
     * Set the last autosave time in the UI.
     * @param {Date} time The time of the last autosave.
     */
    function setLastAutosave(time) {
        const txt = `Saved at: ${dateUtils.formatReadableDate(time)}`;
        $("#last_autosave").text(time || time === 0 ? txt : "");
    }

    /**
     * Indicate that there has been an error in parsing a filter query.
     * @param {string} error The error message to display.
     */
    function setFilterError(error) {
        const input = $("#filter-query-input");
        input.addClass("is-invalid");
        input.removeClass("is-valid");
        $("#filter-query-error").text(error);
    }

    /**
     * Show information about what has been filtered out.
     * @param {number} total The total number of annotations.
     * @param {number} remaining The number of annotations that
     * passed through the filter.
     */
    function setFilterInfo(total, remaining) {
        const input = $("#filter-query-input");
        const info = `Showing ${remaining} out of ${total} annotations`;
        input.removeClass("is-invalid");
        input.addClass("is-valid");
        $("#filter-query-info").text(info);
    }

    /**
     * Clear information text from filter.
     */
    function clearFilterInfo() {
        const input = $("#filter-query-input");
        input.removeClass("is-invalid");
        input.removeClass("is-valid");
    }

    let _urlTimeout=0;
    let _overwriteURL=true; //High (from start and) for 1 second after setURL => replaceState instead of pushState
    
    /**
     * If next setURL to overwrite previous history state or not
     * @param {boolean} value setURL => value?replaceState:pushState
     */
    function setOverwriteURL(value) {
        _overwriteURL=value;
    }
    
    /**
     * Update URL in browser
     * Push to history if standing still long enough.
     * @param {string} url The new state to push.
     */
    function setURL(url) {
        if (!history.state || history.state.page!=url.href) 
        {
            if (_overwriteURL) {
                history.replaceState({ "page": url.href }, "", url.href);
            }
            else {
                history.pushState({ "page": url.href }, "", url.href);
            }
            setOverwriteURL(true);
        }
        if (_urlTimeout) {
            clearTimeout(_urlTimeout);
        }
        _urlTimeout = setTimeout(() => {
            setOverwriteURL(false);
            _urlTimeout = 0;
        }, 1000); //1 second
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
        updateClassSelectionButtons:updateClassSelectionButtons,
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
        setCollabName: setCollabName,
        setImageName: setImageName,
        setImageZLevel: setImageZLevel,
        setImageZoom: setImageZoom,
        setImageRotation: setImageRotation,
        setLastAutosave: setLastAutosave,
        setFilterError: setFilterError,
        setFilterInfo: setFilterInfo,
        clearFilterInfo: clearFilterInfo,
        setURL: setURL,
        setOverwriteURL: setOverwriteURL,
        inFocus: inFocus
    };
})();

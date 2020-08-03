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

    function _openContextMenu(location, buildFun) {
        const menu = $("#context_menu");
        const body = menu.find(".card-body");
        body.empty();
        buildFun(body);

        const maxBottom = menu.height() + location.y;
        const maxRight = menu.width() + location.x;
        const winh = $(window).height();
        const winw = $(window).width();
        const top = maxBottom < winh ? location.y : location.y - menu.height();
        const left = maxRight < winw ? location.x : location.x - menu.width();
        menu.css({top: top, left: left});

        menu.addClass("show");
        menu.focus();
        menu.one("blur", () => menu.removeClass("show"));
    }

    /**
     * Initialize UI components that need to be added programatically
     * and add any event handlers that are needed.
     */
    function initUI() {
        // Set the title
        $("#project_title").text("Cyto Browser");

        // Set the initial class
        tmapp.setMclass(bethesdaClassUtils.getClassFromID(0).name);

        // Add buttons for the available marker classes
        bethesdaClassUtils.forEachClass(function(item, index){
            let label = $("<label></label>");
            label.addClass("btn btn-dark");
            if (index === 0) { label.addClass("active"); }
            label.attr("id", "class_" + item.name);
            label.attr("title", item.description);
            let input = $("<input>" + item.name + "</input>");
            input.attr("type", "radio");
            input.attr("name", "class_options");
            input.attr("autocomplete", "off");
            label.append(input);
            label.click(function(){ tmapp.setMclass(item.name); });
            $("#class_buttons").append(label);
        });

        // Prevent ctrl+scroll zooming in the viewer, since that's for focus
        $("#ISS_viewer").bind("mousewheel DOMMouseScroll", event => {
            event.preventDefault();
        });
        $("#ISS_viewer").contextmenu(() => false);
        $("#context_menu").contextmenu(() => false);
        $(document).focus(() => {
            // A small delay since this seems to fire before any other handlers
            // TODO: Find a cleaner way for clicks to check for focus
            setTimeout(() => _pageInFocus = true, 100);
        });
        $(document).blur(() => {
            _pageInFocus = false;
        });

        // Add event listeners for local storage buttons
        $("#json_to_data").click(() => {
            $("#data_files_import").click();
        });
        $("#data_files_import").change(event => {
            if (event.target.files.length) {
                const loadedJSON = localStorage.loadJSON("data_files_import");
                loadedJSON.then(markerStorageConversion.addMarkerStorageData);
            }
        });
        $("#points_to_json").click(() => {
            const markerData = markerStorageConversion.getMarkerStorageData();
            localStorage.saveJSON(markerData);
        });

        // Initialize the file browser
        fileBrowserUI.init();

        // Add event listeners for focus buttons
        $("#focus_next").click(tmapp.incrementFocus);
        $("#focus_prev").click(tmapp.decrementFocus);

        // Add event listeners for keyboard buttons
        //1,2,... for class selection
        //z,x for focus up down
        $("#main_content").keypress(function(){
            switch(event.which) {
                case "z".charCodeAt():
                    $("#focus_prev").click();
                    break;
                case "x".charCodeAt():
                    $("#focus_next").click();
                    break;
                default:
                    // Handle digit keys being pressed for classes
                    const digits = Array.from({length: 10}, (v, k) => String((k+1) % 10));
                    const chars = digits.map(digit => digit.charCodeAt());
                    chars.slice(0, bethesdaClassUtils.count()).forEach((char, index) => {
                        if (event.which === char) {
                            $("#class_" + bethesdaClassUtils.getClassFromID(index).name).click();
                        }
                    });
            }
        });

        // Set up the collaboration menu
        let nameTimeout;
        const keyUpTime = 3000;
        const defaultName = collabClient.getDefaultName();
        $("#collaboration_start [name='username']").val(defaultName || "");
        $("#collaboration_start [name='username']").keyup(function(event) {
            clearTimeout(nameTimeout);
            nameTimeout = setTimeout(() => {
                const name = $("#collaboration_start [name='username']").val();
                collabClient.changeName(name);
            }, keyUpTime);
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
     * a given marker.
     * @param {number} id The id of the edited marker.
     * @param {Object} location The location of the upper left corner of
     * the menu being opened.
     * @param {number} location.x The x coordinate in page coordinates.
     * @param {number} location.y The y coordinate in page coordinates.
     */
    function openMarkerEditMenu(id, location) {
        _openContextMenu(location, menuBody => {
            menuBody.append("<p>Hello</p>");
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
        $("#collaborator_list").empty();
        members.forEach(member => {
            const color = $("<span></span>");
            color.addClass("badge badge-pill");
            color.css("background-color", member.color);
            color.html("&nbsp;");
            const entry = $("<a></a>");
            const nameTag = $("<span></span>");
            entry.addClass("list-group-item list-group-item-action d-flex justify-content-between align-items-center");
            if (member === localMember || !member.ready) {
                entry.addClass("disabled");
            }
            entry.attr("href", "#");
            nameTag.html(`&nbsp;&nbsp;&nbsp;${member.name}`);
            nameTag.prepend(color);
            entry.append(nameTag);
            const followSpan = $("<span></span>");
            const follow = $("<input type='checkbox'>");
            follow.prop("checked", member.followed);
            entry.append(followSpan.append(follow));
            entry.click(event => {
                event.preventDefault();
                $("#collaboration_menu").modal("hide");
                tmapp.moveTo(member.position);
            });
            follow.click(event => {
                event.stopPropagation();
                if (event.target.checked) {
                    collabClient.followView(member);
                }
                else {
                    collabClient.stopFollowing();
                }
            });
            $("#collaborator_list").append(entry);
        });
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
     * Add an image selection element to the image browser.
     * @param {Object} image Information about the image being added.
     * @param {string} image.name Name of the image.
     * @param {Object} image.thumbnails Thumbnails for image preview.
     * @param {string} image.thumbnails.overview Address to a tile
     * with a zoomed-out view of the image.
     * @param {string} image.thumbnails.detail Address to a tile with
     * a zoomed-out detail view of the image.
     */
    function addImage(image) {
        // Messy function, might want to do it some better way
        let deck = $("#available_images .row").last();
        if (deck.length === 0 || deck.children().length === 3) {
            deck = $("<div></div>");
            deck.addClass("row mb-4");
            $("#available_images").append(deck);
        }
        const col = $("<div></div>");
        col.addClass("col-4 d-flex");
        const card = $("<div></div>");
        card.addClass("card w-100");
        const overview = $("<img>", {src: image.thumbnails.overview});
        overview.addClass("card-img-top position-absolute");
        overview.css({height: "230px", objectFit: "cover"});
        const detail = $("<img>", {src: image.thumbnails.detail});
        detail.addClass("card-img-top hide fade");
        detail.css({zIndex: 9000, pointerEvents: "none", height: "230px", objectFit: "cover"});
        const body = $("<div></div>");
        body.addClass("card-body");
        const title = $("<h5></h5>");
        title.text(image.name);
        title.addClass("card-title");
        const footer = $("<div></div>");
        footer.addClass("card-footer");
        const a = $("<a></a>");
        a.addClass("card-link stretched-link");
        a.attr("href", "#");
        a.text("Open image");
        a.click(e => {
            e.preventDefault();
            $("#image_browser").modal("hide");
            tmapp.openImage(image.name, () => {
                collabClient.swapImage(image.name);
            });
        });
        a.hover(event =>
            detail.addClass("show").removeClass("hide"),
            e =>
            detail.addClass("hide").removeClass("show")
        );
        footer.append(a);
        body.append(title);
        card.append(overview);
        card.append(detail);
        card.append(body);
        card.append(footer);
        col.append(card);
        deck.append(col);
    }

    /**
     * Set the displayed image name in the UI.
     * @param {string} txt The image name to display.
     */
    function setImageName(txt) {
        $("#img_name").text(txt);
    }

    /**
     * Set the displayed z level in the UI.
     * @param {string} txt The z level to display.
     */
    function setImageZLevel(txt) {
        $("#img_zlevel").text(txt);
    }

    /**
     * Set the displayed zoom in the UI.
     * @param {string} txt The zoom value to display.
     */
    function setImageZoom(txt) {
        $("#img_zoom").text(txt);
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
        openMarkerEditMenu: openMarkerEditMenu,
        setCollabID: setCollabID,
        clearCollabID: clearCollabID,
        updateCollaborators: updateCollaborators,
        clearCollaborators: clearCollaborators,
        enableCollabCreation: enableCollabCreation,
        displayImageError: displayImageError,
        clearImageError: clearImageError,
        addImage: addImage,
        setImageName: setImageName,
        setImageZLevel: setImageZLevel,
        setImageZoom: setImageZoom,
        setURL: setURL,
        inFocus: inFocus
    };
})();

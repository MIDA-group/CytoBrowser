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
    let _errorDisplayTimeout = null;
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

    const _holdInterval = 100;
    function _addHoldableButton(key, element, f) {
        let interval;
        element.addEventListener("keydown", (event) => {
            if (event.key === key && !event.repeat) {
                f();
                interval = setInterval(f, _holdInterval);
            }
        });
        element.addEventListener("keyup", (event) => {
            event.key === key && clearInterval(interval);
        });
    }

    /**
     * Initialize UI components that need to be added programatically
     * and add any event handlers that are needed.
     */
    function initUI() {
        // Set the initial class
        tmapp.setMClass(bethesdaClassUtils.getClassFromID(0).name);

        // Add buttons for the available marker classes
        bethesdaClassUtils.forEachClass(function(item, index){
            let label = $("<label></label>");
            label.addClass("btn btn-dark");
            if (index == 0) { label.addClass("active"); }
            label.attr("id", "class_" + item.name);
            label.attr("title", item.description);
            let input = $("<input>" + item.name + "</input>");
            input.attr("type", "radio");
            input.attr("name", "class_options");
            input.attr("autocomplete", "off");
            label.append(input);
            label.click(function(){ tmapp.setMClass(item.name); });
            $("#class_buttons").append(label);
        });

        // Add event listeners for local storage buttons
        $("#pointstojson").click(JSONUtils.downloadJSON);
        $("#jsontodata").click(JSONUtils.readJSONToData);

        // Add event listeners for focus buttons
        $("#focus_next").click(() => tmapp.setFocusLevel(tmapp.getFocusLevel() + 1));
        $("#focus_prev").click(() => tmapp.setFocusLevel(tmapp.getFocusLevel() - 1));

        // Add event listeners for keyboard buttons
        //1,2,... for class selection
        //z,x for focus up down
        _addHoldableButton("c", document, () => $("#focus_prev").click());
        _addHoldableButton("v", document, () => $("#focus_next").click());
        $(document).keypress(function(){
            switch(event.which) {
                case "z".charCodeAt():
                    $("#focus_prev").click();
                    break;
                case "x".charCodeAt():
                    $("#focus_next").click();
                    break;
                default:
                    // Handle digit keys being pressed for classes
                    const digits = Array.from({length: 10}, (v,k) => String((k+1) % 10));
                    const chars = digits.map((digit) => digit.charCodeAt());
                    chars.slice(0, bethesdaClassUtils.amountClasses).forEach((char, index) => {
                        if (event.which == char) {
                            $("#class_" + bethesdaClassUtils.getClassFromID(index).name).click();
                        }
                    });
            }
        });

        // Set up callbacks for the collaboration client
        collabClient.onConnect(function(connection) {
            tmapp.setCollab(connection.id);
        });
        collabClient.onDisconnect(function(connection) {
            tmapp.setCollab();
        });

        // Add handlers for the collaboration menu
        let nameTimeout;
        const keyUpTime = 3000;
        $("#collaboration_start [name='username']").keyup(function(event) {
            clearTimeout(nameTimeout);
            nameTimeout = setTimeout(() => {
                const name = $("#collaboration_start [name='username']").val();
                collabClient.send({
                    type: "memberEvent",
                    eventType: "nameChange",
                    name: name // TODO: Update self
                });
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
            collabClient.connect(id, name, include);
        });
        $("#leave_collaboration").click(function(event) {
            collabClient.disconnect();
        });
    }

    /**
     * Set the ID of the current collaboration so it can be displayed,
     * disable the elements for creating and joining collaborations, and
     * enable the button for leaving the collaboration.
     * @param {string} id Identifier for the active collaboration.
     */
    function setCollabID(id) {
        $("#collaboration_start [name='active_id']").val(id);
        $("#collaboration_start input, #collaboration_start button").prop("disabled", true);
        $("#collaboration_start [name='username']").prop("disabled", false);
        $("#leave_collaboration").prop("disabled", false);
    }

    /**
     * Clear the information about the ongoing collaboration,
     * reenable the buttons for joining and creating collaborations, and
     * disable the button for leaving the collaboration.
     */
    function clearCollabID() {
        $("#collaboration_start [name='active_id']").val("");
        $("#collaboration_start input, #collaboration_start button").prop("disabled", false);
        $("#collaboration_start [name='username']").prop("disabled", false);
        $("#leave_collaboration").prop("disabled", true);
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
        a.click((e) => {
            e.preventDefault();
            tmapp.changeImage(image.name, () => {
                tmappUI.clearImageError();
                collabClient.send({
                    type: "imageSwap",
                    image: image.name
                });
            });
        });
        a.hover((e) =>
            detail.addClass("show").removeClass("hide"),
            (e) =>
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

    return {
        initUI: initUI,
        setCollabID: setCollabID,
        clearCollabID: clearCollabID,
        displayImageError: displayImageError,
        clearImageError: clearImageError,
        addImage: addImage
    };
})();

/**
 * Interface for programatically interacting with the HTML elements not
 * connected to OpenSeadragon. Putting these functions here keeps
 * things in the same place and removes clutter from other namespaces.
 * The initUI() function should be called initially to add the elements
 * that need to be added programatically.
 * @namespace tmappUI
 */
tmappUI = {
    initUI: function() {
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
            $("#class_buttons").append(label);
        });

        // Add handlers for the collaboration menu
        $("#create_collaboration").click(function(event) {
            const name = $("#collaboration_start [name='username']").val();
            collabClient.createCollab(name, (connection) => {
                tmappUI.setCollabID(connection.id);
            });
        });
        $("#join_collaboration").click(function(event) {
            const name = $("#collaboration_start [name='username']").val();
            const id = $("#collaboration_start [name='joined_id']").val();
            collabClient.connect(id, name, (connection) => {
                tmappUI.setCollabID(connection.id);
            });
        });
        $("#leave_collaboration").click(function(event) {
            tmappUI.clearCollabID();
            collabClient.disconnect();
        });
    },
    setCollabID: function(id) {
        $("#collaboration_start [name='active_id']").val(id);
        $("#create_collaboration").prop("disabled", true);
        $("#join_collaboration").prop("disabled", true);
        $("#leave_collaboration").prop("disabled", false);
    },
    clearCollabID: function() {
        $("#collaboration_start [name='active_id']").val("");
        $("#create_collaboration").prop("disabled", false);
        $("#join_collaboration").prop("disabled", false);
        $("#leave_collaboration").prop("disabled", true);
    },
    addImage: function(image) {
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
        a.attr("href", `/?image=${image.name}`);
        a.text("Open image");
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
}

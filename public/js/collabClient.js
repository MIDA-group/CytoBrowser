/**
 * Clientside functions for collaborating.
 * @namespace collabClient
 */
collabClient = {
    _handleMessage: function(msg) {
        switch(msg.type) {
            case "markerAction":
                switch(msg.actionType) {
                    case "add":
                        markerPoints.addPoint(msg.point, "image", false);
                        break;
                    case "update":
                        markerPoints.updatePoint(msg.id, msg.point, "image", false);
                        break;
                    case "remove":
                        markerPoints.removePoint(msg.id, false);
                        break;
                    case "clear":
                        markerPoints.clearPoints(false);
                        break;
                    default:
                        console.warn(`Unknown marker action type: ${msg.actionType}`)
                }
                break;
            case "summary":
                console.info("Receiving collaboration info.");
                if (msg.image !== tmapp.image_name) {
                    // TODO: Change image
                }
                msg.points.forEach((point) => markerPoints.addPoint(point, "image", false));
                break;
            default:
                console.warn(`Unknown message type received in collab: ${msg.type}`);
        }
    },
    /**
     * Create a new collaboration with a unique ID and automatically
     * join it.
     * @param {string} name The name used to identify the participant.
     * @param {boolean} include Whether or not already-placed markers
     * should be included in the collaborative workspace.
     */
    createCollab: function(name, include) {
        // Get a new code for a collab first
        const idReq = new XMLHttpRequest();
        idReq.open("GET", window.location.origin + "/api/collaboration/id", true)
        idReq.send();
        idReq.onreadystatechange = function() {
            if (idReq.readyState === 4 && idReq.status === 200) {
                const response = JSON.parse(idReq.responseText);
                const id = response.id;
                collabClient.connect(id, name, include, callback);
            }
        };
    },

    /**
     * Connect to a collaboration.
     * @param {string} id Identifier for the collaboration being joined.
     * If a collaboration with this identifier does not exist yet, it
     * is created and joined.
     * @param {string} name The name used to identify the participant.
     * @param {boolean} include Whether or not already-placed markers
     * should be included in the collaborative workspace.
     */
    connect: function(id, name="Unnamed", include) {
        if (collabClient.ws) {
            collabClient.disconnect();
        }

        const address = `ws://${window.location.host}/collaboration/${id}?name=${name}&image=${tmapp.image_name}`;
        const ws = new WebSocket(address);
        ws.onopen = function(event) {
            console.info(`Successfully connected to collaboration ${id}.`);
            collabClient.ws = ws;
            collabClient.connection = {id: id, name: name, ws: ws};
            collabClient.connectFun && collabClient.connectFun(collabClient.connection);

            if (include) {
                markerPoints.forEachPoint((point) => {
                    collabClient.send({
                        type: "markerAction",
                        actionType: "add",
                        point: point
                    });
                });
            }
            else if (confirm("All your placed markers will be lost unless you have saved them. Do you want to continue anyway?")) {
                markerPoints.clearPoints();
            }
            else {
                collabClient.disconnect();
            }
        }
        ws.onmessage = function(event) {
            console.log(`Received: ${event.data}`);
            collabClient._handleMessage(JSON.parse(event.data));
        }
        ws.onclose = function(event) {
            delete collabClient.connection;
            delete collabClient.ws;
        }
    },

    /**
     * Disconnect from the currently active collaboration.
     */
    disconnect: function() {
        if (collabClient.ws) {
            collabClient.disconnectFun && collabClient.disconnectFun(collabClient.connection);
            collabClient.ws.close();
        }
        else {
            console.warn("Tried to disconnect from nonexistent collaboration.");
        }
    },

    /**
     * Send a message to the currently ongoing collaboration so it can
     * be handled by the server.
     * @param {Object} msg Message to be sent.
     * @param {string} msg.type Type of the message being sent.
     */
    send: function(msg) {
        if (collabClient.ws) {
            if (typeof(msg) === "object") {
                collabClient.ws.send(JSON.stringify(msg));
            }
            else {
                collabClient.ws.send(msg);
            }
        }
    },

    /**
     * Function that can be set to be called at various points in the
     * collaboration lifeline.
     * @name CollabCallback
     * @function
     * @param {Object} connection Collaboration connection information.
     * @param {string} id Identifier for the collaboration.
     * @param {string} name Name used for this client's participant.
     * @param {WebSocket} ws Websocket object used to communicate with
     * the collaboration on the server.
     */

    /**
     * Set a function to be called whenever the collaboration
     * successfully connects to the server.
     * @param {CollabCallback} f Function to be called.
     */
    onConnect: function(f) {
        collabClient.connectFun = f;
    },

    /**
     * Set a function to be called whenever the collaboration
     * disconnects from the server.
     * @param {CollabCallback} f Function to be called.
     */
    onDisconnect: function(f) {
        collabClient.disconnectFun = f;
    }
}

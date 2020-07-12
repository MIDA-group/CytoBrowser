/**
 * Clientside functions for collaborating.
 * @namespace collabClient
 */
const collabClient = (function(){
    "use strict";
    let _ws,
        _connection,
        _joinBatch,
        _connectFun,
        _disconnectFun;

    function _handleMessage(msg) {
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
                    tmapp.changeImage(msg.image, () => {
                        msg.points.forEach((point) => markerPoints.addPoint(point, "image", false));
                        _joinBatch = null;
                    }, disconnect);
                    break;
                }
                markerPoints.clearPoints(false);
                msg.points.forEach((point) => markerPoints.addPoint(point, "image", false));
                if (_joinBatch) {
                    _joinBatch.forEach((point) => {
                        markerPoints.addPoint(point, "image");
                    });
                    _joinBatch = null;
                }
                break;
            case "imageSwap":
                tmapp.changeImage(msg.image, () => {
                    // Make sure to get any new information from before you swapped
                    send({type: "requestSummary"});
                }, disconnect);
                break;
            default:
                console.warn(`Unknown message type received in collab: ${msg.type}`);
        }
    }

    /**
     * Create a new collaboration with a unique ID and automatically
     * join it.
     * @param {string} name The name used to identify the participant.
     * @param {boolean} include Whether or not already-placed markers
     * should be included in the collaborative workspace.
     */
    function createCollab(name, include) {
        // Get a new code for a collab first
        const idReq = new XMLHttpRequest();
        idReq.open("GET", window.location.origin + "/api/collaboration/id", true)
        idReq.send();
        idReq.onreadystatechange = function() {
            if (idReq.readyState === 4 && idReq.status === 200) {
                const response = JSON.parse(idReq.responseText);
                const id = response.id;
                connect(id, name, include);
            }
        };
    }

    /**
     * Connect to a collaboration.
     * @param {string} id Identifier for the collaboration being joined.
     * If a collaboration with this identifier does not exist yet, it
     * is created and joined.
     * @param {string} name The name used to identify the participant.
     * @param {boolean} include Whether or not already-placed markers
     * should be included in the collaborative workspace.
     */
    function connect(id, name="Unnamed", include=false) {
        if (_ws) {
            disconnect();
        }

        const address = `ws://${window.location.host}/collaboration/${id}?name=${name}&image=${tmapp.image_name}`;
        const ws = new WebSocket(address);
        ws.onopen = function(event) {
            console.info(`Successfully connected to collaboration ${id}.`);
            _ws = ws;
            _connection = {id: id, name: name, ws: ws};
            _connectFun && _connectFun(_connection);

            if (include) {
                _joinBatch = [];
                markerPoints.forEachPoint((point) => {
                    _joinBatch.push(point);
                });
            }
            else if (markerPoints.empty() || confirm("All your placed markers will be lost unless you have saved them. Do you want to continue anyway?")) {
                markerPoints.clearPoints(false);
            }
            else {
                disconnect();
            }
        }
        ws.onmessage = function(event) {
            console.log(`Received: ${event.data}`);
            _handleMessage(JSON.parse(event.data));
        }
        ws.onclose = function(event) {
            _joinBatch = null;
            connection = null;
            ws = null;
        }
    }

    /**
     * Disconnect from the currently active collaboration.
     */
    function disconnect() {
        if (_ws) {
            _disconnectFun && _disconnectFun(_connection);
            _ws.close();
        }
        else {
            console.warn("Tried to disconnect from nonexistent collaboration.");
        }
    }

    /**
     * Send a message to the currently ongoing collaboration so it can
     * be handled by the server.
     * @param {Object} msg Message to be sent.
     * @param {string} msg.type Type of the message being sent.
     */
    function send(msg) {
        if (_ws) {
            if (typeof(msg) === "object") {
                _ws.send(JSON.stringify(msg));
            }
            else {
                _ws.send(msg);
            }
        }
    }

    /**
     * Change the name of the local collaboration member.
     * @param {string} newName The new name to be assigned to the member.
     */
    function changeName(newName) {
        send({
            type: "memberEvent",
            eventType: "nameChange",
            name: newName
        });
    }

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
    function onConnect(f) {
        _connectFun = f;
    }

    /**
     * Set a function to be called whenever the collaboration
     * disconnects from the server.
     * @param {CollabCallback} f Function to be called.
     */
    function onDisconnect(f) {
        _disconnectFun = f;
    }

    return {
        createCollab: createCollab,
        connect: connect,
        disconnect: disconnect,
        send: send,
        changeName: changeName,
        onConnect: onConnect,
        onDisconnect: onDisconnect
    };
})();

collabClient = {
    createCollab: function(name) {
        // Get a new code for a collab first
        const idReq = new XMLHttpRequest();
        idReq.open("GET", window.location.origin + "/api/collaboration/id", true)
        idReq.send();
        idReq.onreadystatechange = function() {
            if (idReq.readyState === 4 && idReq.status === 200) {
                const response = JSON.parse(idReq.responseText);
                const id = response.id;
                collabClient.connect(id, name);
            }
        };
    },
    connect: function(id, name="Unnamed") {
        const address = `ws://${window.location.host}/collaboration/${id}?name=${name}`;
        const ws = new WebSocket(address);
        ws.onopen = function(event) {
            console.info(`Successfully connected to collaboration ${id}.`);
            collabClient.ws = ws;
        }
        ws.onmessage = function(event) {
            console.log(`Received: ${event.data}`);
            collabClient.handleMessage(JSON.parse(event.data));
        }
        ws.onclose = function(event) {
            delete collabClient.ws;
        }
    },
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
    handleMessage: function(msg) {
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
                // TODO: Should maybe call a function in a UI namespace
                $("#collaboration_start [name='active_id']").val(msg.id);
                msg.points.forEach((point) => markerPoints.addPoint(point, "image", false));
                break;
            default:
                console.warn(`Unknown message type received in collab: ${msg.type}`);
        }
    }
}

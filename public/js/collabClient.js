collabClient = {
    createCollab: function() {
        // Get a new code for a collab first
        const idReq = new XMLHttpRequest();
        idReq.open("GET", window.location.origin + "/api/collaboration/id", true)
        idReq.send();
        idReq.onreadystatechange = function() {
            if (idReq.readyState === 4 && idReq.status === 200) {
                const response = JSON.parse(idReq.responseText);
                const id = response.id;
                collabClient.connect(id);
            }
        };
    },
    connect: function(id) {
        const address = `ws://${window.location.host}/collaboration/${id}`;
        const ws = new WebSocket(address);
        ws.onopen = function(event) {
            console.info(`Successfully connected to collaboration ${id}.`);
            collabClient.ws = ws;
        }
        ws.onmessage = function(event) {
            console.log(`Received: ${event.data}`);
        }
        ws.onclose = function(event) {
            delete collabClient.ws;
        }
    },
    send: function(msg) {
        if (collabClient.ws) {
            collabClient.ws.send(msg);
        }
    }
}

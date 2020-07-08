/**
 * @module collaboration
 * @desc Contains necessary server-side logic for collaboration between
 * different users of the CytoBrowser.
 */

// Object for storing all ongoing collaborations
const collabs = {};

class Collaboration {
    constructor(id, image) {
        this.members = new Map();
        this.points = [];
        this.id = id;
        this.image = image;
    }

    addMember(ws, name) {
        this.members.set(ws, {name: name});
        ws.send(JSON.stringify(this.stateSummary()));
        this.broadcastMessage(ws, {
            type: "memberEvent",
            eventType: "connect",
            member: this.members.get(ws)
        });
    }

    removeMember(ws) {
        this.broadcastMessage(ws, {
            type: "memberEvent",
            eventType: "disconnect",
            member: this.members.get(ws)
        });
        this.members.delete(ws);
    }

    broadcastMessage(sender, msg) {
        // Forward the message to all other members
        const msgJSON = JSON.stringify(msg);
        for (let member of this.members.keys()) {
            if (member !== sender) {
                member.send(msgJSON);
            }
        }
    }

    handleMessage(sender, msg) {
        // Keep track of the current points
        switch (msg.type) {
            case "markerAction":
                this.broadcastMessage(sender, msg);
                switch (msg.actionType) {
                    case "add":
                        this.points.push(msg.point);
                        break;
                    case "update":
                        Object.assign(this.points.find((point) => point.id === msg.id), msg.point)
                        break;
                    case "remove":
                        const index = this.points.findIndex((point) => point.id === msg.id);
                        this.points.splice(index, 1);
                        break;
                    case "clear":
                        this.points = [];
                        break;
                    default:
                        console.warn(`Tried to handle unknown marker action: ${msg.actionType}`);
                }
                break;
            default:
                console.info("Received a message with an unknown type, forwarding anyway.");
        }
    }

    stateSummary() {
        return {
            type: "summary",
            id: this.id,
            image: this.image,
            members: Array.from(this.members.values()),
            points: this.points
        }
    }
};

function getCollab(id, image) {
    return collab = collabs.id || (collabs.id = new Collaboration(id, image));
}

/**
 * Generate an unused, randomly generated collaboration ID. There are
 * around 6*10^7 possible IDs that can be generated with this function,
 * as they are generated as five-character lower-case alphanumeric strings.
 * @returns {string} A randomly generated, unused collaboration ID.
 */
function getId() {
    let id;
    do {
        // Generate a random number
        const num = Math.random();
        // Convert the number to an alphanumeric string
        const str = num.toString(36);
        // Shorten the string to something more human-readable
        id = str.match(/(?<=\.).{5}/g)[0];
    } while (collabs.id);
    return id;
}

/**
 * Add a websocket context to a specified collaboration. The collaboration
 * takes care of the necessary initial communication with the new member
 * to make sure that they get all the necessary data. If the collaboration
 * does not already exist, it is created.
 * @param {WebSocket} ws WebSocket object to add to collab.
 * @param {string} name Human-readable name for identifying the new member.
 * @param {string} id ID of the collab being joined.
 * @param {string} image Name of the image observed in the collab. Only
 * has an effect if the collaboration has not been created yet.
 */
function joinCollab(ws, name, id, image) {
    const collab = getCollab(id, image);
    collab.addMember(ws, name);
}

/**
 * Remove a websocket context from a collaboration. Other contexts are
 * notified of their removal.
 * @param {WebSocket} ws WebSocket to remove from collab.
 * @param {string} id ID of collab to remove websocket from.
 */
function leaveCollab(ws, id) {
    const collab = collabs.id;
    if (collab) {
        collab.removeMember(ws);
    }
}

/**
 * Pass a message on to the appropriate collaboration and take the
 * appropriate actions based on its content.
 * @param {WebSocket} ws WebSocket that the message was sent from.
 * @param {string} id ID of the collab the message was sent to.
 * @param {string} msg JSON representation of the message object.
 */
function handleMessage(ws, id, msg) {
    const collab = getCollab(id);
    collab.handleMessage(ws, JSON.parse(msg));
}

exports.getId = getId;
exports.joinCollab = joinCollab;
exports.leaveCollab = leaveCollab;
exports.handleMessage = handleMessage;

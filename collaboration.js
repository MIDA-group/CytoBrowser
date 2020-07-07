// Object for storing all ongoing collaborations
const collabs = {};

class Collaboration {
    constructor(id) {
        this.members = new Map();
        this.points = [];
        this.id = id;
    }

    addMember(ws, name) {
        this.members.set(ws, {name: name});
        ws.send(JSON.stringify(this.stateSummary()));
    }

    removeMember(ws) {
        this.members.delete(ws);
    }

    handleMessage(sender, msg) {
        // Forward the message to all other members
        for (let member of this.members.keys()) {
            if (member !== sender) {
                member.send(msg);
            }
        }

        msg = JSON.parse(msg);

        // Keep track of the current points
        switch (msg.type) {
            case "markerAction":
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
            members: Array.from(this.members.values()),
            points: this.points
        }
    }
};

function getCollab(id) {
    return collab = collabs.id || (collabs.id = new Collaboration(id));
}

// Get an unused ID for collaboration
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

function joinCollab(ws, name, id) {
    const collab = getCollab(id);
    collab.addMember(ws, name);
}

function leaveCollab(ws, id) {
    const collab = collabs.id;
    if (collab) {
        collab.removeMember(ws);
    }
}

function handleMessage(ws, id, msg) {
    const collab = getCollab(id);
    collab.handleMessage(ws, msg);
}

exports.getId = getId;
exports.joinCollab = joinCollab;
exports.leaveCollab = leaveCollab;
exports.handleMessage = handleMessage;

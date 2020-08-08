/**
 * @module collaboration
 * @desc Contains necessary server-side logic for collaboration between
 * different users of the CytoBrowser.
 */

// Object for storing all ongoing collaborations
const collabs = {};

// Utility for generating member colors
function generateColor() {
    let nextH = 0;
    return function() {
        const h = nextH;
        nextH = (nextH + Math.PI * 25) % 360;
        const s = (Math.cos(Math.PI * h / 180) * 20) + 80;
        const l = (Math.cos(Math.PI * h / 180) * 20) + 50;
        return `hsl(${h}, ${s}%, ${l}%)`;
    }
}

class Collaboration {
    constructor(id, image) {
        this.members = new Map();
        this.annotations = [];
        this.id = id;
        this.nextMemberId = 0;
        this.nextColor = generateColor();
        this.image = image;
        this.log(`Initializing collaboration.`, console.info);
    }

    addMember(ws, name) {
        this.members.set(ws, {
            id: this.nextMemberId++,
            name: name,
            color: this.nextColor(),
            position: {},
            ready: false,
        });
        this.log(`${name} has connected.`, console.info);
        this.broadcastMessage(ws, {
            type: "memberEvent",
            eventType: "add",
            member: this.members.get(ws)
        });
    }

    removeMember(ws) {
        const member = this.members.get(ws);
        this.broadcastMessage(ws, {
            type: "memberEvent",
            eventType: "remove",
            member: member
        });
        this.log(`${member.name} has disconnected.`, console.info);
        this.members.delete(ws);
    }

    broadcastMessage(sender, msg) {
        // Forward the message to all other members
        const msgJSON = JSON.stringify(msg);
        for (let [ws, member] of this.members.entries()) {
            if (ws !== sender && member.ready) {
                ws.send(msgJSON);
            }
        }
    }

    handleMessage(sender, msg) {
        // Keep track of the current annotations
        const member = this.members.get(sender);
        switch (msg.type) {
            case "annotationAction":
                if (!member.ready) {
                    // Members who aren't ready shouldn't do anything with annotations
                    break;
                }
                switch (msg.actionType) {
                    case "add":
                        if (!this.isDuplicateAnnotation(msg.annotation)) {
                            this.annotations.push(msg.annotation);
                            this.broadcastMessage(sender, msg);
                        }
                        else {
                            this.log(`${member.name} tried to add a duplicate annotation, ignoring.`, console.info);
                        }
                        break;
                    case "update":
                        Object.assign(this.annotations.find(annotation => annotation.id === msg.id), msg.annotation);
                        this.broadcastMessage(sender, msg);
                        break;
                    case "remove":
                        const index = this.annotations.findIndex(annotation => annotation.id === msg.id);
                        this.annotations.splice(index, 1);
                        this.broadcastMessage(sender, msg);
                        break;
                    case "clear":
                        this.annotations = [];
                        this.broadcastMessage(sender, msg);
                        break;
                    default:
                        this.log(`Tried to handle unknown annotation action: ${msg.actionType}`, console.warn);
                        this.broadcastMessage(sender, msg);
                }
                break;
            case "memberEvent":
                this.broadcastMessage(sender, msg);
                switch (msg.eventType) {
                    case "update":
                        Object.assign(member, msg.member);
                        break;
                    case "cursorUpdate":
                        member.cursor = msg.cursor;
                        break;
                    default:
                        this.log(`Tried to handle unknown member event: ${msg.eventType}`, console.warn);
                }
                break;
            case "imageSwap":
                this.broadcastMessage(sender, msg);
                for (let [ws, member] of this.members.entries()) {
                    if (ws !== sender) {
                        member.ready = false;
                    }
                }
                this.annotations = [];
                this.image = msg.image;
                break;
            case "requestSummary":
                if (msg.image === this.image)
                    member.ready = true;
                sender.send(JSON.stringify(this.stateSummary(sender)));
                this.broadcastMessage(sender, {
                    type: "memberEvent",
                    eventType: "update",
                    hardUpdate: true,
                    member: member
                });
                break;
            default:
                this.broadcastMessage(sender, msg);
                this.log("Received a message with an unknown type, forwarding anyway.", console.info);
        }
    }

    stateSummary(sender) {
        return {
            type: "summary",
            id: this.id,
            requesterId: this.members.get(sender).id,
            image: this.image,
            members: Array.from(this.members.values()),
            annotations: this.annotations
        }
    }

    pointsAreDuplicate(pointsA, pointsB) {
        if (pointsA.length !== pointsB.length)
            return false;

        return pointsA.every((pointA, index) => {
            const pointB = pointsB[index];
            return pointA.x === pointB.x || pointA.y === pointB.y;
        });
    }

    isDuplicateAnnotation(annotation) {
        return this.annotations.some(existingAnnotation =>
            existingAnnotation.z === annotation.z
            && existingAnnotation.mclass === annotation.mclass
            && this.pointsAreDuplicate(annotation.points, existingAnnotation.points)
        );
    }

    log(msg, f = console.log) {
        f(`Collab [${this.id}] -- ${msg}`);
    }
};

function getCollab(id, image) {
    return collab = collabs[id] || (collabs[id] = new Collaboration(id, image));
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
        id = str.slice(2,7);
    } while (collabs[id]);
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
    const collab = collabs[id];
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

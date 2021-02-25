/**
 * @module collaboration
 * @desc Contains necessary server-side logic for collaboration between
 * different users of the CytoBrowser.
 */

// TODO: Make this settable
const autosave = require("./autosave")("./collab_storage");

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
        this.loadState();
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

    /**
     * Broadcast a message to all members except the one who sent it and
     * those who aren't ready. A member has to send a summary request with
     * the right image name before they can be considered ready and receive
     * broadcasts.
     * @param {WebSocket} sender The websocket through which the message
     * was originally received.
     * @param {Object} msg The message that should be broadcast.
     */
    broadcastMessage(sender, msg) {
        // Forward the message to all other members
        const msgJSON = JSON.stringify(msg);
        for (let [ws, member] of this.members.entries()) {
            if (ws !== sender && member.ready) {
                try {
                    ws.send(msgJSON);
                }
                catch (err) {
                    this.log(`WebSocket send failed: ${err.message}`, console.warn);
                }
            }
        }
    }

    handleMessage(sender, msg) {
        // Keep track of the member that sent the message
        const member = this.members.get(sender);
        switch (msg.type) {
            case "annotationAction":
                this.handleAnnotationAction(sender, member, msg);
                break;
            case "memberEvent":
                this.handleMemberEvent(sender, member, msg);
                break;
            case "imageSwap":
                this.handleImageSwap(sender, member, msg);
                break;
            case "requestSummary":
                this.handleRequestSummary(sender, member, msg);
                break;
            default:
                this.broadcastMessage(sender, msg);
                this.log("Received a message with an unknown type, forwarding anyway.", console.info);
        }
    }

    handleAnnotationAction(sender, member, msg) {
        if (!member.ready) {
            // Members who aren't ready shouldn't do anything with annotations
            return;
        }
        this.trySavingState();
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
    }

    handleMemberEvent(sender, member, msg) {
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
    }

    handleImageSwap(sender, member, msg) {
        this.saveState();
        this.broadcastMessage(sender, msg);
        for (let [ws, member] of this.members.entries()) {
            if (ws !== sender) {
                member.ready = false;
            }
        }
        this.image = msg.image;
        this.loadState();
    }

    handleRequestSummary(sender, member, msg) {
        if (msg.image === this.image)
            member.ready = true;
        sender.send(JSON.stringify(this.stateSummary(sender)));
        this.broadcastMessage(sender, {
            type: "memberEvent",
            eventType: "update",
            hardUpdate: true,
            member: member
        });
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

    forceUpdate() {
        const msg = {type: "forceUpdate"};
        const msgJSON = JSON.stringify(msg);
        for (let [ws, member] of this.members.entries()) {
            member.ready = false;
            try {
                ws.send(msgJSON);
            }
            catch (err) {
                this.log(`WebSocket send failed: ${err.message}`, console.warn);
            }
        }
    }

    notifyAutosave() {
        const msg = {type: "autosave", time: Date.now()};
        const msgJSON = JSON.stringify(msg);
        for (let [ws, member] of this.members.entries()) {
            try {
                ws.send(msgJSON);
            }
            catch (err) {
                this.log(`WebSocket send failed: ${err.message}`, console.warn);
            }
        }
    }

    loadState() {
        if (!this.image) {
            return;
        }

        autosave.loadAnnotations(this.id, this.image).then(data => {
            if (data.version === "1.0") {
                this.annotations = data.annotations;
            }
        }).catch(() => {
            this.log(`Couldn't load preexisting annotations for ${this.image}.`, console.info);
            this.annotations = [];
        }).finally(() => {
            this.forceUpdate();
        });
    }

    saveState() {
        if (!this.image) {
            return;
        }

        const data = {
            version: "1.0",
            image: this.image,
            annotations: this.annotations
        };
        autosave.saveAnnotations(this.id, this.image, data).then(() => {
            this.notifyAutosave();
        });
    }

    trySavingState() {
        if (!this.autosaveTimeout) {
            this.autosaveTimeout = setTimeout(() => {
                this.saveState();
                this.autosaveTimeout = null;
            }, 20000);
        }
    }

    pointsAreDuplicate(pointsA, pointsB) {
        if (pointsA.length !== pointsB.length)
            return false;

        return pointsA.every((pointA, index) => {
            const pointB = pointsB[index];
            return pointA.x === pointB.x && pointA.y === pointB.y;
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

/**
 * Get an existing collab with a given id or create a new one.
 * @param {string} id The id of the collab.
 * @param {string} image The image that is being collaborated on. If the
 * collab already exists, this argument is ignored.
 */
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
    try {
        collab.handleMessage(ws, JSON.parse(msg));
    }
    catch (err) {
        collab.log(`Ignoring malformed WebSocket message: ${err.message}`, console.warn);
    }
}

exports.getId = getId;
exports.joinCollab = joinCollab;
exports.leaveCollab = leaveCollab;
exports.handleMessage = handleMessage;

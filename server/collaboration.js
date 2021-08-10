/**
 * @module collaboration
 * @desc Contains necessary server-side logic for collaboration between
 * different users of the CytoBrowser.
 */

const sanitize = require("sanitize-filename");

// Modules initialized in export
let autosave, metadata;

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
        const date = new Date().toISOString().split("T")[0];
        this.members = new Map();
        this.annotations = [];
        this.comments = [];
        this.nextCommentId = 0;
        this.id = id;
        this.name = `Unnamed (Created on ${date})`;
        this.nextMemberId = 0;
        this.nextColor = generateColor();
        this.image = image;
        this.ongoingLoad = new Promise(r => r()); // Dummy promise just in case
        this.hasUnsavedChanges = false;
        this.loadState(false);
        this.log(`Initializing collaboration.`, console.info);
    }

    close() {
        this.saveState().then(wasSaved => {
            if (wasSaved) {
                this.log("Closing collaboration.", console.info);
            }
            else {
                this.log("Closing collaboration without saving.", console.info);
            }
            delete collabs[this.id];
        });
    }

    addMember(ws, name, id) {
        if (this.deathClock) {
            clearTimeout(this.deathClock);
            this.deathClock = null;
        }
        this.members.set(ws, {
            id: id ? id : getId(),
            name: name,
            color: this.nextColor(),
            position: {},
            ready: false,
        });
        this.log(`${name} has connected.`, console.info);
        this.forwardMessage(ws, {
            type: "memberEvent",
            eventType: "add",
            member: this.members.get(ws)
        });
    }

    removeMember(ws) {
        const member = this.members.get(ws);
        this.forwardMessage(ws, {
            type: "memberEvent",
            eventType: "remove",
            member: member
        });
        this.log(`${member.name} has disconnected.`, console.info);
        this.members.delete(ws);
        if (this.members.size === 0) {
            this.deathClock = setTimeout(() => this.close(), 300000);
        }
    }

    /**
     * Send a message to a specified list of recipients. If the recipients
     * parameter is left falsy, it will be sent to all connected users.
     * @param {Object} msg The message to send.
     * @param {Array<WebSocket>} recipients The websockets that should
     * receive the message, or falsy if all should receive.
     * @param {boolean} requireReady Whether or not users have to be
     * ready to receive the message.
     */
    broadcastMessage(msg, recipients, requireReady=false) {
        const msgJSON = JSON.stringify(msg);
        if (!recipients) {
            recipients = Array.from(this.members.keys());
        }
        recipients.forEach(recipient => {
            try {
                if (recipient.readyState === 1
                    && (!requireReady || this.members.get(recipient).ready)) {
                    recipient.send(msgJSON);
                }
            }
            catch (err) {
                this.log(`WebSocket send failed: ${err.message}`, console.warn);
            }
        });
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
    forwardMessage(sender, msg) {
        const allMembers = Array.from(this.members.keys());
        const recipients = allMembers.filter(member => member !== sender);
        this.broadcastMessage(msg, recipients, true);
    }

    handleMessage(sender, msg) {
        // Keep track of the member that sent the message
        const member = this.members.get(sender);
        switch (msg.type) {
            case "annotationAction":
                this.ongoingLoad.then(() => {
                    this.handleAnnotationAction(sender, member, msg);
                });
                break;
            case "metadataAction":
                this.ongoingLoad.then(() => {
                    this.handleMetadataAction(sender, member, msg);
                });
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
            case "nameChange":
                this.handleNameChange(sender, member, msg);
                break;
            default:
                this.forwardMessage(sender, msg);
                this.log("Received a message with an unknown type, forwarding anyway.", console.info);
        }
    }

    handleAnnotationAction(sender, member, msg) {
        if (!member.ready) {
            // Members who aren't ready shouldn't do anything with annotations
            return;
        }
        switch (msg.actionType) {
            case "add":
                if (!this.isDuplicateAnnotation(msg.annotation)) {
                    this.annotations.push(msg.annotation);
                    this.forwardMessage(sender, msg);
                }
                else {
                    this.log(`${member.name} tried to add a duplicate annotation, ignoring.`, console.info);
                }
                break;
            case "update":
                Object.assign(this.annotations.find(annotation => annotation.id === msg.id), msg.annotation);
                this.forwardMessage(sender, msg);
                break;
            case "remove":
                const index = this.annotations.findIndex(annotation => annotation.id === msg.id);
                this.annotations.splice(index, 1);
                this.forwardMessage(sender, msg);
                break;
            case "clear":
                this.annotations = [];
                this.forwardMessage(sender, msg);
                break;
            default:
                this.log(`Tried to handle unknown annotation action: ${msg.actionType}`, console.warn);
                this.forwardMessage(sender, msg);
        }
        this.flagUnsavedChanges();
        this.trySavingState();
    }

    handleMetadataAction(sender, member, msg) {
        if (!member.ready) {
            return;
        }

        switch (msg.actionType) {
            case "addComment":
                const cleanContent = msg.content.trim();
                if (cleanContent.length === 0) {
                    return;
                }
                const comment = {
                    id: this.nextCommentId++,
                    author: member.name,
                    time: Date.now(),
                    content: cleanContent
                };
                this.comments.push(comment);
                this.broadcastMessage({
                    type: "metadataAction",
                    actionType: "addComment",
                    comment: comment
                }, null, true);
                break;
            case "removeComment":
                const commentIndex = this.comments.findIndex(comment =>
                    comment.id === msg.id
                );
                this.comments.splice(commentIndex, 1);
                this.broadcastMessage(msg, null, true);
        }
        this.flagUnsavedChanges();
        this.trySavingState()
    }

    handleMemberEvent(sender, member, msg) {
        this.forwardMessage(sender, msg);
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
        this.forwardMessage(sender, msg);
    }

    handleRequestSummary(sender, member, msg) {
        if (msg.image === this.image)
            member.ready = true;
        sender.send(JSON.stringify(this.stateSummary(sender)));
        this.forwardMessage(sender, {
            type: "memberEvent",
            eventType: "update",
            hardUpdate: true,
            member: member
        });
    }

    handleNameChange(sender, member, msg) {
        if (this.name !== msg.name) {
            this.name = msg.name;
            this.flagUnsavedChanges();
            this.saveState();
            this.forwardMessage(sender, msg);
        }
    }

    stateSummary(sender) {
        return {
            type: "summary",
            id: this.id,
            name: this.name,
            requesterId: this.members.get(sender).id,
            image: this.image,
            members: Array.from(this.members.values()),
            annotations: this.annotations,
            comments: this.comments,
            metadata: metadata.getMetadataForImage(this.image)
        }
    }

    forceUpdate() {
        const msg = {type: "forceUpdate"};
        for (let member of this.members.values()) {
            member.ready = false;
        }
        this.broadcastMessage(msg);
    }

    notifyAutosave() {
        const msg = {type: "autosave", time: Date.now()};
        this.broadcastMessage(msg);
    }

    loadState(forceUpdate=true) {
        if (!this.image) {
            return;
        }

        this.ongoingLoad = this.ongoingLoad.then(() => {
            return autosave.loadAnnotations(this.id, this.image);
        }).then(data => {
            if (data.version === "1.0" || data.version === "1.1") {
                if (data.name) {
                    this.name = data.name;
                }
                this.annotations = data.annotations;
            }
            if (data.version === "1.1") {
                this.comments = data.comments;
                if (this.comments.length > 0) {
                    const commentIds = this.comments.map(comment => comment.id);
                    this.nextCommentId = Math.max(...commentIds) + 1;
                }
            }
        }).catch(() => {
            this.log(`Couldn't load preexisting annotations for ${this.image}.`, console.info);
            this.annotations = [];
            this.comments = [];
        }).finally(() => {
            const nameChangeMsg = {type: "nameChange", name: this.name};
            this.broadcastMessage(nameChangeMsg);
            if (forceUpdate) {
                this.forceUpdate();
            }
        });
    }

    saveState() {
        if (this.hasUnsavedChanges) {
            const data = {
                version: "1.1",
                name: this.name,
                image: this.image,
                annotations: this.annotations,
                comments: this.comments
            };
            return autosave.saveAnnotations(this.id, this.image, data).then(() => {
                this.notifyAutosave();
                this.hasUnsavedChanges = false;
                return true;
            });
        }
        else {
            return Promise.resolve(false);
        }
    }

    flagUnsavedChanges() {
        this.hasUnsavedChanges = true;
    }

    trySavingState() {
        if (!this.autosaveTimeout) {
            this.saveState();
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
 * Generate random collaboration ID. There are around 3e15 possible IDs
 * that can be generated with this function, as they are generated as
 * ten-character lower-case alphanumeric strings.
 * @returns {string} A randomly generated, unused collaboration ID.
 */
function getId() {
    // Generate a random number
    const num = Math.random();
    // Convert the number to an alphanumeric string
    const str = num.toString(36);
    // Remove the decimal
    const id = str.split(".")[1];
    return id;
}

/**
 * Add a websocket context to a specified collaboration. The collaboration
 * takes care of the necessary initial communication with the new member
 * to make sure that they get all the necessary data. If the collaboration
 * does not already exist, it is created.
 * @param {WebSocket} ws WebSocket object to add to collab.
 * @param {string} name Human-readable name for identifying the new member.
 * @param {string} userId The id of the user joining, if one exists.
 * @param {string} id ID of the collab being joined.
 * @param {string} image Name of the image observed in the collab. Only
 * has an effect if the collaboration has not been created yet.
 */
function joinCollab(ws, name, userId, id, image) {
    const cleanImage = sanitize(image);
    const collab = getCollab(id, cleanImage);
    collab.addMember(ws, name, userId);
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
    if (msg === "__ping__") {
        ws.send("__pong__");
        return;
    }
    const collab = getCollab(id);
    try {
        collab.handleMessage(ws, JSON.parse(msg));
    }
    catch (err) {
        collab.log(`Ignoring malformed WebSocket message: ${err.message}`, console.warn);
    }
}

/**
 * Get a list of all collaborations that have previously been saved
 * for a given image.
 * @param {string} image The name of the image.
 * @returns {Promise<Array<Object>>} A promise of the list of available
 * image ids and their names.
 */
function getAvailable(image) {
    const cleanImage = sanitize(image);
    return autosave.getSavedIds(cleanImage);
}

module.exports = function(autosaveDir, metadataJsonDir) {
    autosave = require("./autosave")(autosaveDir);
    metadata = require("./metadata")(metadataJsonDir);
    return {
        getId: getId,
        joinCollab: joinCollab,
        leaveCollab: leaveCollab,
        handleMessage: handleMessage,
        getAvailable: getAvailable
    };
}

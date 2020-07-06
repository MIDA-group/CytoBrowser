// Object for storing all ongoing collaborations
const collabs = {};

class Collaboration {
    constructor(id) {
        this.members = new Set();
        this.id = id;
    }

    addMember(ws) {
        this.members.add(ws);
    }

    removeMember(ws) {
        this.members.delete(ws);
    }

    forward(sender, msg) {
        this.members.forEach((member) => {
            if (member !== sender) {
                member.send(msg);
            }
        });
    }
};

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

function joinCollab(ws, id) {
    const collab = collabs.id || (collabs.id = new Collaboration(id));
    collab.addMember(ws);
}

function leaveCollab(ws, id) {
    const collab = collabs.id;
    if (collab) {
        collab.removeMember(ws);
    }
}

function handleMessage(ws, id, msg) {
    const collab = collabs.id || (collabs.id = new Collaboration(id));
    collab.forward(ws, msg);
}

exports.getId = getId;
exports.joinCollab = joinCollab;
exports.leaveCollab = leaveCollab;
exports.handleMessage = handleMessage;

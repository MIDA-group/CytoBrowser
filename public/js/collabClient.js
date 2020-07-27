/**
 * Clientside functions for collaborating.
 * @namespace collabClient
 */
const collabClient = (function(){
    "use strict";
    let _ws,
        _joinBatch,
        _members,
        _localMember,
        _followedMember;

    const _member = {};

    function _handleMessage(msg) {
        switch(msg.type) {
            case "markerAction":
                _handleMarkerAction(msg);
                break;
            case "memberEvent":
                _handleMemberEvent(msg);
                break;
            case "summary":
                _handleSummary(msg);
                break;
            case "imageSwap":
                _handleImageSwap(msg);
                break;
            default:
                console.warn(`Unknown message type received in collab: ${msg.type}`);
        }
    }

    function _handleMarkerAction(msg) {
        switch(msg.actionType) {
            case "add":
                markerHandler.addMarker(msg.marker, "image", false);
                break;
            case "update":
                markerHandler.updateMarker(msg.id, msg.marker, "image", false);
                break;
            case "remove":
                markerHandler.removeMarker(msg.id, false);
                break;
            case "clear":
                markerHandler.clearMarkers(false);
                break;
            default:
                console.warn(`Unknown marker action type: ${msg.actionType}`);
        }
    }

    function _handleMemberEvent(msg) {
        if (!_members) {
            throw new Error("Tried to handle member event without an initialized member array.");
        }
        const member = _members.find(member =>
            msg.member ? member.id === msg.member.id : member.id === msg.id
        );
        switch(msg.eventType) {
            case "add":
                _members.push(msg.member);
                _memberUpdate()
                break;
            case "update":
                Object.assign(member, msg.member);
                if (member === _followedMember) {
                    _followedMember.updated = true;
                }
                _memberUpdate(msg.hardUpdate);
                break;
            case "cursorUpdate":
                member.cursor = msg.cursor;
                _memberUpdate(false);
                break;
            case "remove":
                const memberIndex = _members.findIndex(member => member.id === msg.member.id);
                _members.splice(memberIndex, 1);
                if (member === _followedMember) {
                    _followedMember.removed = true;
                }
                _memberUpdate();
                break;
            default:
                console.warn(`Unknown member event: ${msg.eventType}`);
        }
    }

    function _handleSummary(msg) {
        if (msg.image !== tmapp.getImageName()) {
            tmapp.openImage(msg.image, () => {
                _joinBatch = null;
                _requestSummary();
            }, disconnect);
            return;
        }
        if (_joinBatch) {
            markerHandler.forEachMarker(marker => {
                _joinBatch.push(marker);
            });
        }
        markerHandler.clearMarkers(false);
        msg.markers.forEach(marker => {
            markerHandler.addMarker(marker, "image", false)
        });
        if (_joinBatch) {
            _joinBatch.forEach(marker => {
                markerHandler.addMarker(marker, "image");
            });
            _joinBatch = null;
        }
        _members = msg.members;
        _localMember = _members.find(member => member.id === msg.requesterId);
        _memberUpdate();
        tmapp.updateCollabStatus();
    }

    function _requestSummary() {
        send({type: "requestSummary"});
    }

    function _handleImageSwap(msg) {
        tmapp.openImage(msg.image, () => {
            // Make sure to get any new information from before you swapped
            _requestSummary();
        }, disconnect);
    }

    function _memberUpdate(hardUpdate = true) {
        if (hardUpdate) {
            tmappUI.updateCollaborators(_localMember, _members);
        }
        overlayHandler.updateMembers(_members.filter(member => member !== _localMember));

        if (_followedMember) {
            if (_followedMember.updated) {
                tmapp.moveTo(member.position);
                _followedMember.updated = false;
            }
            if (_followedMember.removed) {
                stopFollowing();
            }
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
    function connect(id, name=getDefaultName(), include=false) {
        if (_ws) {
            disconnect();
        }

        const address = `ws://${window.location.host}/collaboration/`+
            `${id}?name=${name}&image=${tmapp.getImageName()}`;
        const ws = new WebSocket(address);
        ws.onopen = function(event) {
            console.info(`Successfully connected to collaboration ${id}.`);
            _ws = ws;
            tmapp.setCollab(id);

            if (include) {
                _joinBatch = [];
                _requestSummary();
            }
            else if (markerHandler.empty() || confirm("All your placed markers will be lost unless you have saved them. Do you want to continue anyway?")) {
                markerHandler.clearMarkers(false);
                _requestSummary();
            }
            else {
                disconnect();
            }
        }
        ws.onmessage = function(event) {
            _handleMessage(JSON.parse(event.data));
        }
        ws.onclose = function(event) {
            _joinBatch = null;
            _members = null;
            _localMember = null;
            _ws = null;
            stopFollowing();
            overlayHandler.updateMembers([]);
            tmappUI.clearCollaborators();
            tmapp.clearCollab();
        }
    }

    /**
     * Disconnect from the currently active collaboration.
     */
    function disconnect() {
        if (_ws) {
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
     * Notify collaborators about an image being swapped.
     * @param {string} imageName Name of the image being swapped to.
     */
    function swapImage(imageName) {
        send({
            type: "imageSwap",
            image: imageName
        });
    }

    /**
     * Notify collaborators about a marker being added.
     * @param {Object} marker Data for the added marker.
     */
    function addMarker(marker) {
        send({
            type: "markerAction",
            actionType: "add",
            marker: marker
        });
    }

    /**
     * Notify collaborators about a marker being updated.
     * @param {number} id The original id of the marker being updated.
     * @param {Object} marker Data for the updated marker.
     */
    function updateMarker(id, marker) {
        send({
            type: "markerAction",
            actionType: "update",
            id: id,
            marker: marker
        });
    }

    /**
     * Notify collaborators about a marker being removed.
     * @param {number} id The id of the marker being removed.
     */
    function removeMarker(id) {
        send({
            type: "markerAction",
            actionType: "remove",
            id: id
        });
    }

    /**
     * Notify collaborators of all markers being cleared.
     */
    function clearMarkers() {
        send({
            type: "markerAction",
            actionType: "clear"
        });
    }

    /**
     * Change the name of the local collaboration member.
     * @param {string} newName The new name to be assigned to the member.
     */
    function changeName(newName) {
        let expiryDate = new Date();
        expiryDate.setTime(expiryDate.getTime() + 1e10);
        document.cookie = `last_used_collab_name=${newName};samesite=strict;expires=${expiryDate.toGMTString()}`;
        if (_localMember) {
            _localMember.name = newName;
            send({
                type: "memberEvent",
                eventType: "update",
                hardUpdate: true,
                member: _localMember
            });
            _memberUpdate(_localMember, _members);
        }
    }

    /**
     * Get the default name for the collaboration member by retrieving
     * their most recently used name from a cookie.
     * @return {string|undefined} The name that should be used by default.
     */
    function getDefaultName() {
        const nameCookie = document.cookie.match(/(?<=last_used_collab_name=)[^;|$]*/g);
        if (nameCookie) {
            return nameCookie[0];
        }
    }

    /**
     * Update the position of the local collaboration member in the
     * OSD viewport.
     * @param {Object} position The new position of the collaborator.
     * @param {Object} position.x X position of the viewport in viewport coordinates.
     * @param {Object} position.y Y position of the viewport in viewport coordinates.
     * @param {Object} position.z Z level of the viewport.
     * @param {Object} position.zoom Zoom level of the viewport.
     */
    function updatePosition(position) {
        if (_localMember) {
            _localMember.position = position;
            send({
                type: "memberEvent",
                eventType: "update",
                hardUpdate: false,
                member: _localMember
            })
        }
    }

    /**
     * Update the position and status of the local collaboration member's
     * mouse cursor.
     * @param {Object} cursor Current status of the cursor.
     * @function
     */
    const updateCursor = (function(){
        // Limit the rate at which move updates are sent
        const moveInterval = 200;
        let cooldown = false;
        let queued = false;

        function sendUpdate() {
            send({
                type: "memberEvent",
                eventType: "cursorUpdate",
                id: _localMember.id,
                cursor: _localMember.cursor
            });
        }

        function updateCursor(cursor) {
            if (_localMember) {
                // Check if the only update is a cursor move
                const prevCursor =
                    _localMember.cursor
                    || (_localMember.cursor = {});
                const moveOnly =
                    prevCursor.hold === cursor.hold
                    && prevCursor.inside === cursor.inside;

                // Assign a copy of the cursor state so it can be compared
                Object.assign(prevCursor, cursor);
                if (moveOnly) {
                    sendUpdate();
                }
                else {
                    if (cooldown) {
                        queued = true;
                    }
                    else {
                        cooldown = true;
                        sendUpdate();
                        window.setTimeout(() => {
                            cooldown = false;
                            if (queued) {
                                queued = false;
                                sendUpdate();
                            }
                        }, moveInterval);
                    }
                }
            }
        }
        return updateCursor
    })();

    /**
     * Begin following a specified collaborator's view.
     * @param {Object} member The specific member to follow.
     */
    function followView(member) {
        _followedMember = member;
    }

    /**
     * Stop following the currently followed view.
     */
    function stopFollowing() {
        _followedMember = null;
    }

    return {
        createCollab: createCollab,
        connect: connect,
        disconnect: disconnect,
        send: send,
        swapImage: swapImage,
        addMarker: addMarker,
        updateMarker: updateMarker,
        removeMarker: removeMarker,
        clearMarkers: clearMarkers,
        changeName: changeName,
        getDefaultName: getDefaultName,
        updatePosition: updatePosition,
        updateCursor: updateCursor,
        followView: followView,
        stopFollowing: stopFollowing
    };
})();

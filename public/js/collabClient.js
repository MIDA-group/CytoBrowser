/**
 * Clientside functions for collaborating.
 * @namespace collabClient
 */
const collabClient = (function(){
    "use strict";
    let _ws,
        _collabId,
        _joinBatch,
        _members,
        _localMember,
        _followedMember,
        _desiredMember,
        _userId,
        _onCreated;

    const _idleTime = 20 * 60 * 1000; // 20 minutes
    const _keepaliveTime = 30 * 1000; // sending ping every 30s
    let _idleTimeout, _keepaliveTimeout;

    let _ongoingDestruction = new Promise(r => r());
    let _resolveOngoingDestruction;

    const _member = {};

    /**
     * Handle an incoming message from the server.
     * @param {Object} msg The message being received.
     * @param {string} msg.type The type of message being received.
     */
    function _handleMessage(msg) {
        switch(msg.type) {
            case "annotationAction":
                _handleAnnotationAction(msg);
                break;
            case "metadataAction":
                _handleMetadataAction(msg);
                break;
            case "versionAction":
                _handleVersionAction(msg);
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
            case "autosave":
                _handleAutosave(msg);
                break;
            case "forceUpdate":
                _requestSummary();
                break;
            case "nameChange":
                _handleNameChange(msg);
                break;
            default:
                console.warn(`Unknown message type received in collab: ${msg.type}`);
        }
    }

    function _handleAnnotationAction(msg) {
        switch(msg.actionType) {
            case "add":
                annotationHandler.add(msg.annotation, "image", false);
                break;
            case "update":
                annotationHandler.update(msg.id, msg.annotation, "image", false);
                break;
            case "remove":
                annotationHandler.remove(msg.id, false);
                break;
            case "clear":
                annotationHandler.clear(false);
                break;
            default:
                console.warn(`Unknown annotation action type: ${msg.actionType}`);
        }
    }

    function _handleMetadataAction(msg) {
        switch(msg.actionType) {
            case "addComment":
                globalDataHandler.handleCommentFromServer(msg.comment);
                break;
            case "removeComment":
                globalDataHandler.handleCommentRemovalFromServer(msg.id);
                break;
            default:
                console.warn(`Unknown metadata action type: ${msg.actionType}`);
        }
    }

    function _handleVersionAction(msg) {
        switch(msg.actionType) {
            case "versionInfo":
                versionRevert.setVersions(msg.history);
                break;
            default:
                console.warn(`Unknown version action type: ${msg.actionType}`);
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

    /**
     * Handle a collaboration summary received from the server. The summary
     * contains information about the current state of the collaboration,
     * including which image is being collaborated on, which members are
     * taking part, and which annotations have been placed. The summary is
     * only sent to a collaborator if they explicitly request it with
     * _requestSummary(), and the server will not send any other messages
     * to a collaborator until they do. If the received summary matches
     * the image the local member is already on, the annotations  and
     * members from the collaboration are added locally. If _joinBatch
     * is truthy, the local member's annotations are first cleared and
     * then added to the collaboration. If the image does not match, the
     * image is swapped, _joinBatch is set to null, and another request
     * summary is sent.
     * @param {Object} msg The summary message.
     * @param {string} msg.image The name of the current image being
     * collaborated on in the collaboration.
     * @param {Array<annotationHandler.Annotation>} msg.annotations The
     * annotations currently placed in the collaboration.
     * @param {Array<Object>} msg.members The members participating in
     * the collaboration.
     * @param {number} msg.requesterId The id assigned to the local member
     * by the server.
     */
    function _handleSummary(msg) {
        if (msg.image !== tmapp.getImageName()) {
            tmapp.openImage(msg.image, () => {
                _joinBatch = null;
                _requestSummary();
            }, disconnect);
            return;
        }
        if (_joinBatch) {
            annotationHandler.forEachAnnotation(annotation => {
                _joinBatch.push(annotation);
            });
        }
        metadataHandler.clear();
        globalDataHandler.clear();
        metadataHandler.updateMetadataValues(msg.metadata);
        annotationHandler.clear(false);
        msg.annotations.forEach(annotation => {
            annotationHandler.add(annotation, "image", false)
        });
        if (_joinBatch) {
            _joinBatch.forEach(annotation => {
                annotationHandler.add(annotation, "image");
            });
            _joinBatch = null;
        }
        msg.comments.forEach(comment => {
            globalDataHandler.handleCommentFromServer(comment);
        });
        _members = msg.members;
        _localMember = _members.find(member => member.id === msg.requesterId);
        _userId= _localMember.id;

        _memberUpdate();
        tmappUI.setCollabName(msg.name);
        tmapp.updateCollabStatus();
        if (_onCreated) {
            _onCreated();
            _onCreated = null;
        }
    }

    function _requestSummary() {
        send({
            type: "requestSummary",
            image: tmapp.getImageName()
        });
    }

    function _handleImageSwap(msg) {
        if (_followedMember && _followedMember.id === msg.id) {
            const target = _followedMember.id;
            swapImage(msg.image, msg.collab);
            disconnect();
            tmapp.openImage(msg.image, () => {
                connect(msg.collab);
                _desiredMember = target;
            }, disconnect);
        }
    }

    function _handleAutosave(msg) {
        const time = new Date(msg.time);
        tmappUI.setLastAutosave(time);
    }

    function _handleNameChange(msg) {
        tmappUI.setCollabName(msg.name);
    }

    function _destroy() {
        stopFollowing();
        _joinBatch = null;
        _members = null;
        _localMember = null;
        _ws = null;
        _collabId  = null;
        overlayHandler.updateMembers([]);
        tmappUI.clearCollaborators();
        tmapp.clearCollab();
        versionRevert.clear();
        _resolveOngoingDestruction && _resolveOngoingDestruction();
    }

    function _attemptReconnect() {
        console.info(`Attempting to reconnect to ${_collabId}.`);
        connect(_collabId, getDefaultName(), false);
    }

    function _promptReconnect(title) {
        const choices = [{
            label: "Reconnect",
            click: _attemptReconnect
        }];
        tmappUI.choice(title, choices, null, true);
    }

    function _becomeIdle() {
        if (_ws && _ws.readyState === 1) {
            _ws.close(4000, "User was idle for too long.");
        }
    }

    function _postponeIdle() {
        clearTimeout(_idleTimeout);
        _idleTimeout = setTimeout(_becomeIdle, _idleTime);
    }

    function _keepalive() {
        send("__ping__", false);
        _keepaliveTimeout = setTimeout(_keepalive, _keepaliveTime);
    }

    function _stopKeepalive() {
        clearTimeout(_keepaliveTimeout);
    }

    /**
     * Perform any actions that should be performed if the members are
     * updated. This includes updating cursors in the overlay and moving
     * the viewport if the local member is following any member.
     * @param {boolean} hardUpdate If set to true, this means that a
     * member has updated in a way that requires updating the non-OSD
     * DOM elements, e.g. if they change their name or leave the collaboration.
     */
    function _memberUpdate(hardUpdate = true) {
        if (!_members) {
            return;
        }
        if (hardUpdate) {
            tmappUI.updateCollaborators(_localMember, _members);
        }
        overlayHandler.updateMembers(_members.filter(member => member !== _localMember));

        if (_followedMember) {
            if (_followedMember.updated) {
                tmapp.moveTo(_followedMember.position);
                _followedMember.updated = false;
            }
            if (_followedMember.removed) {
                stopFollowing();
            }
        }
        else if (_desiredMember) {
            const target = _members.find(member => member.id === _desiredMember);
            if (target) {
                _desiredMember = null;
                followView(target);
            }
        }
    }

    /**
     * Create a new collaboration with a unique ID and automatically
     * join it.
     * @param {string} name The name used to identify the participant.
     * @param {boolean} include Whether or not already-placed annotations
     * should be included in the collaborative workspace.
     * @param {Function} onCreated Function to call when the collaboration
     * has been successfully created and fully connected to the server.
     */
    function createCollab(name=getDefaultName(), include=false, onCreated=null) {
        // Get a new code for a collab first
        _onCreated = onCreated;
        const idReq = new XMLHttpRequest();
        idReq.open("GET", window.location.api + "/collaboration/id", true)
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
     * @param {boolean} include Whether or not already-placed annotations
     * should be included in the collaborative workspace.
     * @param {boolean} askAboutInclude Whether or not the user should be
     * prompted about the inclusion of annotations.
     */
    function connect(id, name=getDefaultName(), include=false, askAboutInclude=false) {
        tmappUI.displayImageError("loadingcollab");
        if (_ws) {
            if (_ws.readyState === 1) {
                swapImage(tmapp.getImageName(), id);
            }
            disconnect();
        }
        _ongoingDestruction = _ongoingDestruction.then(() => {
            const wsProtocol = (window.location.protocol === 'https:')?'wss://':'ws://';
            const imageName = tmapp.getImageName();
            const address = `${window.location.host}${window.location.dirname}/collaboration/` +
                `${id}?name=${name}&image=${imageName ? imageName : ""}` +
                `&userId=${_userId ? _userId : ""}`;
            const ws = new WebSocket(wsProtocol+address);
            ws.onopen = function(event) {
                console.info(`Successfully connected to collaboration ${id}.`);
                tmappUI.clearImageError();

                _ws = ws;
                _collabId = id;
                tmapp.setCollab(id);
                _keepalive();

                if (include) {
                    _joinBatch = [];
                    _requestSummary();
                }
                else if (!askAboutInclude || annotationHandler.isEmpty() || confirm("All your placed annotations will be lost unless you have saved them. Do you want to continue anyway?")) {
                    annotationHandler.clear(false);
                    _requestSummary();
                }
                else {
                    disconnect();
                }
            }
            ws.onmessage = function(event) {
                if (event.data !== "__pong__") {
                    _handleMessage(JSON.parse(event.data));
                }
            }
            ws.onclose = function(event) {
                _stopKeepalive();
                if (event.code === 1000) {
                    _destroy();
                }
                else {
                    tmappUI.displayImageError("loadingcollab");
                    const title = event.code === 4000 ?
                        "Connection closed due to inactivity"
                        : "Lost connection to the server";
                    setTimeout(() => _promptReconnect(title), 2000);
                }
            }
        });
    }

    /**
     * Disconnect from the currently active collaboration.
     */
    function disconnect() {
        if (_ws) {
            _ws.close(1000, "Collaboration was closed normally.");
            _ongoingDestruction = _ongoingDestruction.then(() => {
                return new Promise((resolve, reject) => {
                    _resolveOngoingDestruction = resolve;
                    if (_ws.readyState === 4 || _ws.readyState === 3) {
                        _resolveOngoingDestruction();
                    }
                }).then(() => {
                    _resolveOngoingDestruction = null;
                });
            });
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
    function send(msg, resetIdle=true) {
        if (_ws) {
            if (resetIdle) {
                _postponeIdle();
            }
            if (typeof(msg) === "object") {
                _ws.send(JSON.stringify(msg));
            }
            else {
                _ws.send(msg);
            }
        }
    }

    /**
     * Notify collaborators that you are moving to another image.
     * @param {string} imageName Name of the image being swapped to.
     * @param {string} collabId The collab being joined.
     */
    function swapImage(imageName, collabId) {
        send({
            type: "imageSwap",
            image: imageName,
            collab: collabId,
            id: _localMember.id
        });
    }

    /**
     * Notify collaborators about an annotation being added.
     * @param {Object} annotation Data for the added annotation.
     */
    function addAnnotation(annotation) {
        send({
            type: "annotationAction",
            actionType: "add",
            annotation: annotation
        });
    }

    /**
     * Notify collaborators about an annotation being updated.
     * @param {number} id The original id of the annotation being updated.
     * @param {Object} annotation Data for the updated annotation.
     */
    function updateAnnotation(id, annotation) {
        send({
            type: "annotationAction",
            actionType: "update",
            id: id,
            annotation: annotation
        });
    }

    /**
     * Notify collaborators about an annotation being removed.
     * @param {number} id The id of the annotation being removed.
     */
    function removeAnnotation(id) {
        send({
            type: "annotationAction",
            actionType: "remove",
            id: id
        });
    }

    /**
     * Notify collaborators of all annotations being cleared.
     */
    function clearAnnotations() {
        send({
            type: "annotationAction",
            actionType: "clear"
        });
    }

    /**
     * Add a comment to the current collaboration.
     * @param {string} content The text content of the comment.
     */
    function addComment(content) {
        send({
            type: "metadataAction",
            actionType: "addComment",
            content: content
        });
    }

    /**
     * Remove a comment from the current collaboration.
     * @param {number} id The id of the comment to be removed.
     */
    function removeComment(id) {
        send({
            type: "metadataAction",
            actionType: "removeComment",
            id: id
        });
    }

    /**
     * Change the name of the local collaboration member.
     * @param {string} newName The new name to be assigned to the member.
     */
    function changeUsername(newName) {
        userInfo.setName(newName);
        tmappUI.setUserName(userInfo.getName());
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
        return userInfo.getName();
    }

    /**
     * Change the name of the collaboration.
     * @param {string} newName The new name of the collaboration.
     */
    function changeCollabName(newName) {
        tmappUI.setCollabName(newName);
        send({
            type: "nameChange",
            name: newName
        });
    }

    /**
     * Update the position of the local collaboration member in the
     * OSD viewport.
     * @param {Object} position The new position of the collaborator.
     * @param {Object} position.x X position of the viewport in viewport coordinates.
     * @param {Object} position.y Y position of the viewport in viewport coordinates.
     * @param {Object} position.z Z level of the viewport.
     * @param {Object} position.rotation Rotation of the viewport.
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
        if (!member || member.id === undefined || !member.position) {
            throw new Error("Argument should be a member.");
        }
        stopFollowing();
        _desiredMember = null;
        _followedMember = member;
        _followedMember.followed = true;
        _followedMember.updated = true;
        tmapp.disableControls();
        _memberUpdate();
        _localMember.following = member.id;
        send({
            type: "memberEvent",
            eventType: "update",
            hardUpdate: true,
            member: _localMember
        });
    }

    /**
     * Stop following the currently followed view.
     */
    function stopFollowing() {
        if (_followedMember) {
            _followedMember.followed = false;
            _followedMember = null;
        }
        tmapp.enableControls();
        _memberUpdate();
        _localMember.following = null;
        send({
            type: "memberEvent",
            eventType: "update",
            hardUpdate: true,
            member: _localMember
        });
    }

    /**
     * TODO
     */
    function getVersions() {
        send({
            type: "versionAction",
            actionType: "getVersions"
        });
    }

    /**
     * TODO
     */
    function revertVersion(versionId) {
        send({
            type: "versionAction",
            actionType: "revert",
            versionId: versionId
        });
    }

    return {
        createCollab: createCollab,
        connect: connect,
        disconnect: disconnect,
        send: send,
        swapImage: swapImage,
        addAnnotation: addAnnotation,
        updateAnnotation: updateAnnotation,
        removeAnnotation: removeAnnotation,
        clearAnnotations: clearAnnotations,
        addComment: addComment,
        removeComment: removeComment,
        changeUsername: changeUsername,
        getDefaultName: getDefaultName,
        changeCollabName: changeCollabName,
        updatePosition: updatePosition,
        updateCursor: updateCursor,
        followView: followView,
        stopFollowing: stopFollowing,
        getVersions: getVersions,
        revertVersion: revertVersion
    };
})();

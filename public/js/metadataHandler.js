/**
 * Namespace for handling the metadata of a slide and collaboration.
 * @namespace metadataHandler
 */
const metadataHandler = (function() {
    const _comments = [];
    let _updateFun = null;

    function _updateCommentSection() {
        if (!_updateFun) {
            console.warn("Could not handle comment as there is no update function set.");
        }
        else {
            _updateFun(_comments);
        }
    }

    /**
     * Submit a comment that should be added to the global comments of
     * the current session.
     * @param {string} commentText The text of the comment being submitted.
     */
    function sendCommentToServer(commentText) {
        collabClient.addComment(commentText);
    }

    /**
     * Tell the server that a comment should be deleted.
     * @param {number} id The id of the comment to be removed.
     */
    function sendCommentRemovalToServer(id) {
        collabClient.removeComment(id);
    }

    /**
     * Receive a comment from the server and display it in the global
     * comment section.
     * @param {Object} comment The new comment to be added.
     */
    function handleCommentFromServer(comment) {
        _comments.push(comment);
        _updateCommentSection();
    }

    /**
     * Receive a comment removal instruction from the server.
     * @param {number} id The id of the comment to be removed.
     */
    function handleCommentRemovalFromServer(id) {
        const commentIndex = _comments.findIndex(comment =>
            comment.id === id
        );
        if (commentIndex >= 0) {
            _comments.splice(commentIndex, 1);
            _updateCommentSection();
        }
        else {
            throw Error("Server tried to delete a comment that doesn't exist locally.");
        }
    }

    /**
     * Set the function that should be called with the comment list
     * whenever the comments are updated.
     * @param {Function} updateFun The new update function.
     */
    function setCommentUpdateFun(updateFun) {
        _updateFun = updateFun;
    }

    /**
     * Iterate some function over copies of all global comments.
     * @param {Function} f The function to be called on all comments.
     */
    function forEachComment(f) {
        _comments.forEach(comment => f(Object.assign({}, comment)));
    }

    function clear() {
        _comments.length = 0;
        _updateCommentSection();
    }

    return {
        sendCommentToServer: sendCommentToServer,
        sendCommentRemovalToServer: sendCommentRemovalToServer,
        handleCommentFromServer: handleCommentFromServer,
        handleCommentRemovalFromServer: handleCommentRemovalFromServer,
        setCommentUpdateFun: setCommentUpdateFun,
        forEachComment: forEachComment,
        clear: clear
    };
})();

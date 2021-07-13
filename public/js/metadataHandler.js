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

    function sendCommentToServer(commentText) {
        collabClient.addComment(commentText);
    }

    function sendCommentRemovalToServer(id) {
        collabClient.removeComment(id);
    }

    function handleCommentFromServer(comment) {
        _comments.push(comment);
        _updateCommentSection();
    }

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

    function setCommentUpdateFun(updateFun) {
        _updateFun = updateFun;
    }

    function forEachComment(f) {
        _comments.forEach(comment => f(comment));
        // TODO
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

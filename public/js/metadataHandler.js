/**
 * Namespace for handling the metadata of a slide and collaboration.
 * @namespace metadataHandler
 */
const metadataHandler = (function() {
    // TODO: Comments
    const comments = [];

    // Get a copy of the comments
    // Update the comment list
    // Send comments over collaboration
    function sendCommentToServer(commentText) {
        collabClient.addComment(commentText);
    }

    function handleCommentFromServer(comment) {
        console.log(comment);
        // TODO
    }

    function forEachComment(f) {
        comments.forEach(comment => f(comment));
        // TODO
    }

    return {
        sendCommentToServer: sendCommentToServer,
        handleCommentFromServer: handleCommentFromServer,
        forEachComment: forEachComment
    };
})();

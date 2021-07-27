class CommentSection {
    /**
     * @param {Function} stickStateFun A function that can be called with no
     * argument to see if the comment section HTML is currently in a
     * state where the user is following new comments, or with an argument
     * to set the state manually.
     * @param {Function} updateFun Function to be called with an array
     * of comments that updates the HTML that displays the comments.
     */
    constructor(stickStateFun, updateFun) {
        this.isVisible = false;
        this.ids = [];
        this.unseenIds = [];
        this.stickStateFun = stickStateFun;
        this.updateFun = updateFun;
    }

    /**
     * Update the necessary HTML with a new list of comments.
     * @param {Array<Object>} comments The new comments to display in
     * the HTML.
     * @returns {number} The total number of comments that the user
     * has not yet seen, either because the comment section is not
     * visible or because the user has scrolled up in the list and cannot
     * see the new comments.
     */
    _updateHtml(comments) {
        const isSticking = this.stickStateFun();
        if (!this.isVisible && isSticking && this.unseenIds.length > 0) {
            this.stickStateFun(false);
        }
        else if (this.isVisible && isSticking) {
            this.unseenIds.length = 0;
        }
        this.updateFun(comments);
        return this.unseenIds.length;
    }

    /**
     * Set whether or not the comment section should be considered
     * visible to the viewer. By default, the comment section is not
     * visible, so it would have to be set as visible with this function
     * if it should be initialized as visible.
     * @param {boolean} isVisible The new visibility state.
     */
    setVisibility(isVisible) {
        this.isVisible = isVisible;
    }

    /**
     * Replace the current list of comments with a new list of comments.
     * @param {Array<Object>} comments The new list of comments.
     */
    updateComments(comments) {
        const ids = comments.map(comment => comment.id);
        const oldIds = this.ids;
        const addedIds = ids.filter(id => !oldIds.includes(id));
        const removedIds = oldIds.filter(id => !ids.includes(id));
        this.unseenIds = this.unseenIds.filter(id => !removedIds.includes(id));
        this.unseenIds = this.unseenIds.concat(addedIds);
        this.ids = ids;
        const nUnseen = this._updateHtml(comments);
        return nUnseen;
    }


    // Function for showing number of new
}

// domein/BatchActions.js
// Vereenvoudigd — episode-selectie is verwijderd in het AniList-model.
// Dit bestand is behouden voor API-compatibiliteit met bestaande code.

window.BatchActions = (function() {

    /**
     * Stub: batchbar is niet meer nodig zonder episode-selectie.
     *
     * @returns {void}
     */
    function renderBatchBar() {
        const bar = document.getElementById('batch-bar');
        if (bar) {
            bar.remove();
        }
    }

    /**
     * Wist de huidige selectie.
     *
     * @returns {void}
     */
    function clearSelection() {
        selectedEpisodes.clear();
        renderBatchBar();
    }

    /**
     * Stub: batch status is niet meer nodig.
     *
     * @returns {void}
     */
    function applyBatchStatus() {
        // No-op
    }

    return {
        renderBatchBar,
        clearSelection,
        applyBatchStatus
    };
})();

// domein/StatusCalculator.js
// Vereenvoudigd: status en progress komen nu direct uit AniList,
// niet meer berekend uit individuele afleveringen.

window.StatusCalculator = (function () {

    /**
     * Geeft de RASCAL-macrostatus van een item terug.
     * Mapping: AniList PLANNING → -1, CURRENT/PAUSED → 0, COMPLETED/REPEATING → 1, DROPPED → -1
     *
     * @param {Object} item - Het anime data object met _rascalStatus.
     * @returns {number} -1 (te bekijken), 0 (bezig), of 1 (bekeken).
     */
    function getAnimeStatus(item) {
        if (!item) return -1;
        if (typeof item._rascalStatus === 'number') return item._rascalStatus;
        return -1;
    }

    /**
     * Geeft het aantal bekeken afleveringen terug.
     *
     * @param {Object} item - Het anime data object met progress.
     * @returns {number} Aantal bekeken episodes.
     */
    function getAnimeProgress(item) {
        if (!item) return 0;
        return item.progress || 0;
    }

    return {
        getAnimeStatus,
        getAnimeProgress
    };
})();

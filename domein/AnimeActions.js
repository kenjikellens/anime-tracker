// domein/AnimeActions.js
/**
 * AnimeActions module — API-wrappers voor het wijzigen van status en progress.
 * In het AniList-model worden mutaties direct naar de API gepusht.
 */

window.AnimeActions = (function() {

    /** AniList status mapping: RASCAL (-1/0/1) → AniList string */
    const STATUS_TO_ANILIST = {
        '-1': 'PLANNING',
        '0': 'CURRENT',
        '1': 'COMPLETED'
    };

    /** AniList status mapping: AniList string → RASCAL (-1/0/1) */
    const ANILIST_TO_STATUS = {
        'PLANNING': -1,
        'CURRENT': 0,
        'COMPLETED': 1,
        'REPEATING': 1,
        'PAUSED': 0,
        'DROPPED': -1
    };

    /**
     * Zet een AniList status-string om naar een RASCAL macro-status.
     *
     * @param {string} anilistStatus
     * @returns {number}
     */
    function toRascalStatus(anilistStatus) {
        return ANILIST_TO_STATUS[anilistStatus] ?? -1;
    }

    /**
     * Zet een RASCAL macro-status om naar een AniList status-string.
     *
     * @param {number} rascalStatus
     * @returns {string}
     */
    function toAniListStatus(rascalStatus) {
        return STATUS_TO_ANILIST[String(rascalStatus)] || 'PLANNING';
    }

    /**
     * Wijzigt de status van een item lokaal en pusht naar AniList.
     *
     * @param {Object} item - Het anime-item met anilist_id, progress, episodes, etc.
     * @param {number} newStatus - De nieuwe RASCAL-status (-1, 0, 1).
     * @returns {void}
     */
    function setStatusLocally(item, newStatus) {
        if (!item) return;
        item._rascalStatus = newStatus;
        item._anilistStatus = toAniListStatus(newStatus);

        // Bij "Bekeken" zet progress gelijk aan totaal episodes
        if (newStatus === 1 && item.episodes && item.episodes > 0) {
            item.progress = item.episodes;
        }
        // Bij "Te Bekijken" reset progress naar 0
        if (newStatus === -1) {
            item.progress = 0;
        }
    }

    /**
     * Verhoogt de progress van een item met 1.
     *
     * @param {Object} item
     * @returns {void}
     */
    function incrementProgress(item) {
        if (!item) return;
        const max = item.episodes || 0;
        if (max > 0 && item.progress < max) {
            item.progress += 1;
        }
        // Auto-complete als alle episodes bekeken
        if (max > 0 && item.progress >= max) {
            item._rascalStatus = 1;
            item._anilistStatus = 'COMPLETED';
        } else if (item.progress > 0 && item._rascalStatus === -1) {
            item._rascalStatus = 0;
            item._anilistStatus = 'CURRENT';
        }
    }

    /**
     * Verlaagt de progress van een item met 1.
     *
     * @param {Object} item
     * @returns {void}
     */
    function decrementProgress(item) {
        if (!item) return;
        if (item.progress > 0) {
            item.progress -= 1;
        }
        // Was completed, nu niet meer
        if (item.episodes && item.progress < item.episodes && item._rascalStatus === 1) {
            item._rascalStatus = 0;
            item._anilistStatus = 'CURRENT';
        }
        // Terug naar planning als progress 0
        if (item.progress === 0) {
            item._rascalStatus = -1;
            item._anilistStatus = 'PLANNING';
        }
    }

    return {
        toRascalStatus,
        toAniListStatus,
        setStatusLocally,
        incrementProgress,
        decrementProgress
    };
})();

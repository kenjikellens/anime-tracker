// domein/AnimeActions.js
/**
 * AnimeActions module contains pure domain logic for mutating anime statuses.
 * It provides safe methods to update episodes, seasons, and overall anime status.
 */

window.AnimeActions = (function() {

    /**
     * Sets the status of an individual episode.
     * Note: Top-level franchise/series status is not set here but recomputed on-the-fly.
     * 
     * @param {Object} item - The target anime series object.
     * @param {Object} season - The target season object.
     * @param {Object} episode - The specific episode object to mutate.
     * @param {number} newStatus - The new status to assign (-1, 0, or 1).
     */
    function setEpisodeStatusLocally(item, season, episode, newStatus) {
        episode.status = newStatus;
        // Overall status is computed on-the-fly by StatusCalculator — do not write to item.status
    }

    /**
     * Mutator to update the progress status of an entire season block in one action.
     * 
     * Behavior:
     * - Status 1 (Watched) or -1 (To Watch): Overrides all episodes in this season to the target status.
     * - Status 0 (Watching): Dynamically finds the first unwatched episode and marks it as 'Watching'.
     * 
     * @param {Object} item - The target anime series object.
     * @param {Object} season - The target season object to mutate.
     * @param {number} newStatus - The chosen target status (-1, 0, 1).
     */
    function setSeasonStatusLocally(item, season, newStatus) {
        if (newStatus === 1 || newStatus === -1) {
            // Action A or C: All episodes in this season get the new status.
            season.episodes.forEach(ep => ep.status = newStatus);
        } else if (newStatus === 0) {
            // Action B: Scan for the FIRST episode that is NOT 'Watched' (1) and set it to 'Watching' (0).
            const firstUnwatched = season.episodes.find(ep => ep.status !== 1);
            if (firstUnwatched) {
                firstUnwatched.status = 0;
            }
        }
    }

    /**
     * Main mutator to change the status of a complete series or movie.
     * Cascades across all seasons for series.
     * 
     * @param {Object} item - The franchise or series/movie object from the database.
     * @param {number} newStatus - The resulting target status (-1, 0, 1).
     */
    function setAnimeStatusLocally(item, newStatus) {
        if (!item.seasons || item.seasons.length === 0) {
            // Movie or item without season data
            if (item.type === 'movie') {
                item.status = newStatus;
            }
            return;
        }

        if (newStatus === 1 || newStatus === -1) {
            // Action A or C: All episodes of all seasons get the new status.
            item.seasons.forEach(s => {
                s.episodes.forEach(ep => ep.status = newStatus);
            });
        } else if (newStatus === 0) {
            // Action B: Scan across all seasons for the first open episode.
            let found = false;
            for (const s of item.seasons) {
                const firstUnwatched = s.episodes.find(ep => ep.status !== 1);
                if (firstUnwatched) {
                    firstUnwatched.status = 0;
                    found = true;
                    break;
                }
            }
            if (!found) {
                // Edge case: everything was already 1 but user forced 0; do nothing.
            }
        }
    }

    return {
        setEpisodeStatusLocally,
        setSeasonStatusLocally,
        setAnimeStatusLocally
    };
})();

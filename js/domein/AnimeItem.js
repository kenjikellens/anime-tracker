/**
 * Domain model for one item inside an anime group.
 */
export class AnimeItem {
    constructor(id, title, watched, status, type, watchedEpisodes, episodesCount, rating) {
        this.id = id;
        this.title = title;
        this.type = type || "";
        this.episodesCount = episodesCount || 0;
        this.watchedEpisodes = Array.isArray(watchedEpisodes) ? watchedEpisodes : [];
        this.rating = rating || 0;

        if (status !== undefined) {
            this.status = parseInt(status, 10);
        } else if (watched !== undefined) {
            this.status = watched ? 1 : -1;
        } else {
            this.status = -1;
        }
    }

    /**
     * Updates the item string.
     */
    setRating(newRating) {
        this.rating = parseFloat(newRating) || 0;
    }

    /**
     * Updates the item status.
     */
    setStatus(newStatus) {
        this.status = parseInt(newStatus, 10);
    }

    /**
     * Toggles one watched episode number.
     */
    toggleEpisode(episodeNum) {
        const idx = this.watchedEpisodes.indexOf(episodeNum);
        if (idx === -1) {
            this.watchedEpisodes.push(episodeNum);
            return true;
        } else {
            this.watchedEpisodes.splice(idx, 1);
            return false;
        }
    }

    /**
     * Marks every episode as watched.
     */
    setAllWatched() {
        this.watchedEpisodes = [];
        for (let i = 1; i <= this.episodesCount; i++) {
            this.watchedEpisodes.push(i);
        }
    }

    /**
     * Clears all watched episode progress.
     */
    clearAllEpisodes() {
        this.watchedEpisodes = [];
    }

    /**
     * Marks the first episode as watched.
     */
    setFirstWatched() {
        if (!this.watchedEpisodes.includes(1)) {
            this.watchedEpisodes.push(1);
        }
    }
}

/**
 * Keeps item status, episode progress, and global anime status in sync.
 * Linked to: the detail page dropdowns and episode checkboxes.
 */
export class StatusUpdater {
    /**
     * Applies one global status and cascades the change to every item.
     */
    static updateGlobalStatus(anime, newStatus) {
        const s = parseInt(newStatus, 10);
        anime.setGlobalStatus(s);

        if (s === 1) {
            anime.items.forEach(item => {
                item.setStatus(1);
                item.setAllWatched();
            });
        } else if (s === -1) {
            anime.items.forEach(item => {
                item.setStatus(-1);
                item.clearAllEpisodes();
            });
        } else if (s === 2) {
            anime.items.forEach(item => {
                item.setStatus(2);
            });
        }
    }

    /**
     * Applies one item status and adjusts its episode state.
     */
    static updateItemStatus(item, newStatus, anime) {
        const s = parseInt(newStatus, 10);
        item.setStatus(s);

        if (s === 1) {
            item.setAllWatched();
        } else if (s === -1) {
            item.clearAllEpisodes();
        } else if (s === 0) {
            if (item.watchedEpisodes.length === 0) {
                item.setFirstWatched();
            }
        }

        if (anime) {
            this.syncAnimeStatus(anime);
        }
    }

    /**
     * Toggles one episode and derives the item status from progress.
     */
    static toggleEpisode(item, episodeNum, anime) {
        item.toggleEpisode(episodeNum);

        const watchedCount = item.watchedEpisodes.length;
        const total = item.episodesCount || 12;

        if (watchedCount === 0) {
            item.setStatus(-1);
        } else if (watchedCount >= total) {
            item.setStatus(1);
        } else {
            item.setStatus(0);
        }

        if (anime) {
            this.syncAnimeStatus(anime);
        }
    }

    /**
     * Derives the anime-level status from the collection of item statuses.
     */
    static syncAnimeStatus(anime) {
        if (!anime.items || anime.items.length === 0) return;

        const statuses = anime.items.map(i => i.status);
        const hasBusy = statuses.includes(0);
        const hasWatched = statuses.includes(1);
        const hasNew = statuses.includes(2);

        if (hasBusy || (hasWatched && statuses.includes(-1))) {
            anime.setGlobalStatus(0);
        } else if (hasNew) {
            anime.setGlobalStatus(2);
        } else if (hasWatched) {
            anime.setGlobalStatus(1);
        } else {
            anime.setGlobalStatus(-1);
        }
    }
}

/**
 * Keeps item status, episode progress, and global anime status in sync.
 * Linked to: the detail page dropdowns and episode checkboxes.
 */
export class StatusUpdater {
    /**
     * Applies one global status and cascades the change to every item.
     */
    static updateGlobalStatus(anime, newStatus) {
        const parsedStatus = parseInt(newStatus, 10);
        const s = parsedStatus === 2 ? -1 : parsedStatus;
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
        }
    }

    /**
     * Applies one item status and adjusts its episode state.
     * Clears episodes for status -1 and 2 (Nieuw), and triggers parent anime status sync.
     */
    static updateItemStatus(item, newStatus, anime) {
        const s = parseInt(newStatus, 10);
        item.setStatus(s);

        if (s === 1) {
            item.setAllWatched();
        } else if (s === -1 || s === 2) {
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
     * Derives the anime-level status and isNieuw property from the collection of item statuses.
     * Affects parent anime status and its isNieuw boolean flag.
     */
    static syncAnimeStatus(anime) {
        anime.isNieuw = anime.items ? anime.items.some(item => item.status === 2) : false;
        if (!anime.items || anime.items.length === 0) return;

        anime.setGlobalStatus(this.deriveAnimeStatus(anime));
    }

    /**
     * Normalizes legacy global "Nieuw" statuses to a calculated status and updates the isNieuw boolean.
     * Affects the global anime status and the data store.
     */
    static normalizeAnimeStatuses(anime) {
        let changed = false;

        if (anime.status === 2) {
            anime.setGlobalStatus(-1);
            changed = true;
        }

        const isNewNow = anime.items ? anime.items.some(item => item.status === 2) : false;
        if (anime.isNieuw !== isNewNow) {
            anime.isNieuw = isNewNow;
            changed = true;
        }

        if (!anime.items || anime.items.length === 0) {
            return changed;
        }

        const nextStatus = this.deriveAnimeStatus(anime);
        if (anime.status !== nextStatus) {
            anime.setGlobalStatus(nextStatus);
            changed = true;
        }

        return changed;
    }

    /**
     * Derives the anime-level status from the collection of item statuses.
     * Treats item status 2 (Nieuw) as -1 (Te Bekijken) for calculation and returns -1, 0, or 1.
     */
    static deriveAnimeStatus(anime) {
        const statuses = anime.items.map(i => i.status === 2 ? -1 : i.status);
        const hasBusy = statuses.includes(0);
        const hasWatched = statuses.includes(1);
        const hasUnstarted = statuses.includes(-1);
        const allWatched = statuses.every(status => status === 1);

        if (hasBusy) {
            return 0;
        }
        if (hasWatched && hasUnstarted) {
            return 0;
        }
        if (allWatched) {
            return 1;
        }
        return -1;
    }
}

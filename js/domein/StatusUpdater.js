/**
 * Keeps item status, episode progress, and global anime status in sync.
 * Linked to: the detail page dropdowns and episode checkboxes.
 */
export class StatusUpdater {
    static RELEASE_STATUSES = [2, 3];

    /**
     * Applies one global status and cascades the change to every non-release item.
     * Affects the global status of the anime and the status of all non-upcoming items.
     */
    static updateGlobalStatus(anime, newStatus) {
        const parsedStatus = parseInt(newStatus, 10);
        const s = [-1, 0, 1].includes(parsedStatus) ? parsedStatus : -1;
        anime.setGlobalStatus(s);

        if (s === 1) {
            anime.items.forEach(item => {
                if (!this.RELEASE_STATUSES.includes(item.status)) {
                    item.setStatus(1);
                    item.setAllWatched();
                }
            });
        } else if (s === -1) {
            anime.items.forEach(item => {
                if (!this.RELEASE_STATUSES.includes(item.status)) {
                    item.setStatus(-1);
                    item.clearAllEpisodes();
                }
            });
        }
    }

    /**
     * Applies one item status and adjusts its episode state.
     * Clears episodes for unstarted and release statuses, and triggers parent anime status sync.
     */
    static updateItemStatus(item, newStatus, anime) {
        const s = parseInt(newStatus, 10);
        item.setStatus(s);

        if (s === 1) {
            item.setAllWatched();
        } else if (s === -1 || this.RELEASE_STATUSES.includes(s)) {
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
     * Derives the anime-level watch status from the collection of item statuses.
     */
    static syncAnimeStatus(anime) {
        if (!anime.items || anime.items.length === 0) return;

        anime.setGlobalStatus(this.deriveAnimeStatus(anime));
    }

    /**
     * Normalizes top-level anime statuses to calculated watch statuses.
     */
    static normalizeAnimeStatuses(anime) {
        let changed = false;

        if (![ -1, 0, 1 ].includes(anime.status)) {
            anime.setGlobalStatus(-1);
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
     * Ignores release-only items so the global status represents released watch progress.
     */
    static deriveAnimeStatus(anime) {
        const watchItems = anime.items ? anime.items.filter(i => !this.RELEASE_STATUSES.includes(i.status)) : [];
        if (watchItems.length === 0) {
            return -1;
        }
        const statuses = watchItems.map(i => i.status);
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

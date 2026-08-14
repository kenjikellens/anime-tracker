/**
 * Keeps item status, episode progress, and global anime status in sync.
 * Linked to: the detail page dropdowns and episode checkboxes.
 */
export class StatusUpdater {
    static RELEASE_STATUSES = [2, 3];

    /**
     * Applies one global status and cascades the change to every non-release item if set to watched or unstarted.
     * Affects the global status of the anime.
     */
    static updateGlobalStatus(anime, newStatus) {
        const parsedStatus = parseInt(newStatus, 10);
        const s = [-1, 0, 1, 4].includes(parsedStatus) ? parsedStatus : -1;
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
     * Item status changes do not automatically mutate the parent anime status.
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
    }

    /**
     * Toggles one episode and derives the item status from progress.
     * Does not automatically mutate the parent anime status.
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
    }

    /**
     * Normalizes top-level anime status to ensure it is a valid watch status integer.
     * Preserves the user's explicitly set status without overwriting it from child items.
     */
    static normalizeAnimeStatuses(anime) {
        let changed = false;

        if (![-1, 0, 1, 4].includes(anime.status)) {
            anime.setGlobalStatus(-1);
            changed = true;
        }

        return changed;
    }
}

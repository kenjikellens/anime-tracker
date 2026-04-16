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

        anime.setGlobalStatus(this.deriveAnimeStatus(anime));
    }

    /**
     * Normalizes legacy "Nieuw" item data and recalculates the anime status.
     */
    static normalizeAnimeStatuses(anime) {
        if (!anime.items || anime.items.length === 0) {
            if (anime.status === 2) {
                anime.setGlobalStatus(-1);
                return true;
            }
            return false;
        }

        let changed = false;
        anime.items.forEach(item => {
            if (item.status === 2) {
                item.setStatus(-1);
                changed = true;
            }
        });

        const nextStatus = this.deriveAnimeStatus(anime);
        if (anime.status !== nextStatus) {
            anime.setGlobalStatus(nextStatus);
            changed = true;
        }

        return changed;
    }

    /**
     * Derives the anime-level status from the collection of item statuses.
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
            return 2;
        }
        if (allWatched) {
            return 1;
        }
        return -1;
    }
}

export class StatusUpdater {
    static updateGlobalStatus(anime, newStatus) {
        const s = parseInt(newStatus, 10);
        anime.setGlobalStatus(s);
        
        // Cascade down
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
    
    static updateItemStatus(item, newStatus, anime) {
        const s = parseInt(newStatus, 10);
        item.setStatus(s);
        
        // Episode logic
        if (s === 1) {
            item.setAllWatched();
        } else if (s === -1) {
            item.clearAllEpisodes();
        } else if (s === 0) {
            // "Bezig": if nothing watched, watch the first one
            if (item.watchedEpisodes.length === 0) {
                item.setFirstWatched();
            }
        }
        
        if (anime) {
            this.syncAnimeStatus(anime);
        }
    }
    
    static toggleEpisode(item, episodeNum, anime) {
        item.toggleEpisode(episodeNum);
        
        // Calculate item status from episodes
        const watchedCount = item.watchedEpisodes.length;
        const total = item.episodesCount || 12; // Fallback consistent with renderer
        
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
    
    static syncAnimeStatus(anime) {
        if (!anime.items || anime.items.length === 0) return;
        
        const statuses = anime.items.map(i => i.status);
        const hasBusy = statuses.includes(0);
        const hasWatched = statuses.includes(1);
        const hasToWatch = statuses.includes(-1);
        
        if (hasBusy || (hasWatched && hasToWatch)) {
            anime.setGlobalStatus(0); // Bezig
        } else if (hasWatched && !hasToWatch) {
            anime.setGlobalStatus(1); // Bekeken
        } else {
            anime.setGlobalStatus(-1); // Te Bekijken
        }
    }
}
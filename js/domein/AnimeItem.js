export class AnimeItem {
    constructor(id, title, watched, status, type, watchedEpisodes, episodesCount) {
        this.id = id;
        this.title = title;
        this.type = type || "";
        this.episodesCount = episodesCount || 0; // Initialize from data if provided
        this.watchedEpisodes = Array.isArray(watchedEpisodes) ? watchedEpisodes : [];
        
        // Data migration logic on the fly
        if (status !== undefined) {
            this.status = parseInt(status, 10);
        } else if (watched !== undefined) {
            this.status = watched ? 1 : -1;
        } else {
            this.status = -1;
        }
    }
    setStatus(newStatus) {
        this.status = parseInt(newStatus, 10);
    }
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
    setAllWatched() {
        this.watchedEpisodes = [];
        for (let i = 1; i <= this.episodesCount; i++) {
            this.watchedEpisodes.push(i);
        }
    }
    clearAllEpisodes() {
        this.watchedEpisodes = [];
    }
    setFirstWatched() {
        if (!this.watchedEpisodes.includes(1)) {
            this.watchedEpisodes.push(1);
        }
    }
}
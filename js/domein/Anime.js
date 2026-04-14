import { AnimeItem } from './AnimeItem.js';

/**
 * Domain model for one anime franchise or title group.
 */
export class Anime {
    constructor(data) {
        this.id = data.id;
        this.anilistId = data.anilistId || null;
        this.title = data.title;
        this.status = data.status;
        this.rating = data.rating || 0;
        this.releaseDate = data.releaseDate || "";
        this.coverImage = data.coverImage || "";
        this.bannerImage = data.bannerImage || "";
        this.items = data.items ? data.items.map(item => new AnimeItem(item.id, item.title, item.watched, item.status, item.type, item.watchedEpisodes, item.episodesCount, item.rating)) : [];
    }

    /**
     * Updates the global status for the whole anime.
     */
    setGlobalStatus(newStatus) {
        this.status = newStatus;
    }

    /**
     * Updates the stored rating value.
     */
    setRating(newRating) {
        this.rating = newRating;
    }

    /**
     * Calculates the average rating of all rated items within this anime.
     */
    getAverageItemRating() {
        const ratedItems = this.items.filter(i => i.rating > 0);
        if (ratedItems.length === 0) return 0;
        
        const sum = ratedItems.reduce((acc, i) => acc + i.rating, 0);
        return parseFloat((sum / ratedItems.length).toFixed(1));
    }
}

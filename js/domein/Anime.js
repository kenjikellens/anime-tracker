import { AnimeItem } from './AnimeItem.js';

export class Anime {
    constructor(data) {
        this.id = data.id;
        this.title = data.title;
        this.status = data.status; // -1: Te Bekijken, 0: Bezig, 1: Bekeken
        this.rating = data.rating || 0;
        this.releaseDate = data.releaseDate || "";
        this.coverImage = data.coverImage || "";
        this.format = data.format || "";
        this.items = data.items ? data.items.map(item => new AnimeItem(item.id, item.title, item.watched, item.status, item.type, item.watchedEpisodes)) : [];
    }
    setGlobalStatus(newStatus) {
        this.status = newStatus;
    }
    setRating(newRating) {
        this.rating = newRating;
    }
}
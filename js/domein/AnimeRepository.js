import { Anime } from './Anime.js';

export class AnimeRepository {
    constructor() {
        this.animes = [];
    }
    
    loadFromData(dataArray) {
        this.animes = dataArray.map(data => new Anime(data));
    }
    
    getAll() {
        return this.animes;
    }
    
    getById(id) {
        return this.animes.find(a => a.id === id);
    }

    filterByStatus(statusStr) {
        if (statusStr === 'all') return this.animes;
        const s = parseInt(statusStr, 10);
        return this.animes.filter(a => a.status === s);
    }
    
    exportToData() {
        return this.animes.map(a => ({
            id: a.id,
            title: a.title,
            status: a.status,
            rating: a.rating,
            releaseDate: a.releaseDate,
            coverImage: a.coverImage,
            format: a.format,
            items: a.items.map(i => ({ id: i.id, title: i.title, status: i.status, type: i.type, watchedEpisodes: i.watchedEpisodes }))
        }));
    }
}
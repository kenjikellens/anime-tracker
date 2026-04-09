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

    static filterByQuery(animes, query) {
        if (!query || query.trim() === '') return animes;
        const q = query.toLowerCase().trim();
        return animes.filter(a => a.title.toLowerCase().includes(q));
    }

    static sort(animes, criteria) {
        const list = [...animes];
        switch (criteria) {
            case 'title-asc':
                return list.sort((a, b) => a.title.localeCompare(b.title));
            case 'title-desc':
                return list.sort((a, b) => b.title.localeCompare(a.title));
            case 'rating-desc':
                return list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
            case 'rating-asc':
                return list.sort((a, b) => (a.rating || 0) - (b.rating || 0));
            case 'status':
                return list.sort((a, b) => a.status - b.status);
            default:
                return list;
        }
    }
    
    exportToData() {
        return this.animes.map(a => ({
            id: a.id,
            title: a.title,
            status: a.status,
            rating: a.rating,
            releaseDate: a.releaseDate,
            coverImage: a.coverImage,
            bannerImage: a.bannerImage,
            items: a.items.map(i => ({ id: i.id, title: i.title, status: i.status, type: i.type, watchedEpisodes: i.watchedEpisodes, episodesCount: i.episodesCount }))
        }));
    }
}
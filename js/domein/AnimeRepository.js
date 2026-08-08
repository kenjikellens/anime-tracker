import { Anime } from './Anime.js';
import { StatusUpdater } from './StatusUpdater.js';

/**
 * In-memory collection of anime models.
 * Linked to: `DataStore` for persistence and both renderers for output.
 */
export class AnimeRepository {
    constructor() {
        this.animes = [];
        this.byIdMap = new Map();
    }

    /**
     * Loads raw dataset array into Anime models and normalizes statuses.
     * This mutates the internal collection and returns true if any values changed.
     * @param {Array} dataArray - The raw anime dataset.
     * @returns {boolean} True if any status was modified during normalization.
     */
    loadAndNormalize(dataArray) {
        this.loadFromData(dataArray);
        let normalized = false;
        this.animes.forEach(anime => {
            normalized = StatusUpdater.normalizeAnimeStatuses(anime) || normalized;
        });
        return normalized;
    }

    /**
     * Turns raw JSON rows into `Anime` instances and updates the O(1) Map index.
     * @param {Array} dataArray - Raw anime data objects.
     */
    loadFromData(dataArray) {
        this.animes = dataArray.map(data => new Anime(data));
        this.byIdMap.clear();
        this.animes.forEach(anime => this.byIdMap.set(anime.id, anime));
    }

    /**
     * Returns the full collection.
     * @returns {Array<Anime>} The internal anime array.
     */
    getAll() {
        return this.animes;
    }

    /**
     * Returns one anime by id in O(1) time.
     * @param {string} id - The anime ID to lookup.
     * @returns {Anime|undefined} The matching anime model or undefined.
     */
    getById(id) {
        return this.byIdMap.get(id);
    }

    /**
     * Filters the anime collection by top-level watch status or item-only release status.
     * @param {string} statusStr - The filter status identifier.
     * @returns {Array<Anime>} Filtered anime models.
     */
    filterByStatus(statusStr) {
        if (statusStr === 'all') return this.animes;
        if (statusStr === 'airing') {
            return this.animes.filter(a => a.items.some(item => item.status === 3));
        }
        if (statusStr === 'upcoming') {
            return this.animes.filter(a => a.items.some(item => item.status === 2));
        }
        const s = parseInt(statusStr, 10);
        return this.animes.filter(a => a.status === s);
    }

    /**
     * Filters the collection by a case-insensitive title query.
     * @param {Array<Anime>} animes - The list of animes to filter.
     * @param {string} query - The search query string.
     * @returns {Array<Anime>} Filtered animes matching title query.
     */
    static filterByQuery(animes, query) {
        if (!query || query.trim() === '') return animes;
        const q = query.toLowerCase().trim();
        return animes.filter(a => a.title.toLowerCase().includes(q));
    }

    /**
     * Sorts anime records for the toolbar sort selector.
     * @param {Array<Anime>} animes - The list of animes to sort.
     * @param {string} criteria - The sort criteria identifier.
     * @returns {Array<Anime>} Sorted copy of animes list.
     */
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

    /**
     * Serializes the repository collection into a plain JSON format for file persistence.
     * @returns {Array<Object>} Plain data array ready for JSON serialization.
     */
    exportToData() {
        return this.animes.map(a => ({
            id: a.id,
            anilistId: a.anilistId || null,
            title: a.title,
            status: [-1, 0, 1].includes(a.status) ? a.status : -1,
            rating: a.rating,
            releaseDate: a.releaseDate,
            coverImage: a.coverImage,
            studio: a.studio || "",
            year: a.year || null,
            genres: a.genres || [],

            items: a.items.map(i => ({ id: i.id, title: i.title, status: i.status, type: i.type, rating: i.rating, watchedEpisodes: i.watchedEpisodes, episodesCount: i.episodesCount }))
        }));
    }
}

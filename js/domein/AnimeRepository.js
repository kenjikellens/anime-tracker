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
     * Includes smart matching for status '4' (Verder Kijken).
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
        if (statusStr === '4') {
            return this.animes.filter(a => {
                if (a.status === 4) return true;
                // Bekeken anime with an active Airing item or a newly released uncompleted season
                if (a.status === 1 && a.items.some(i => i.status === 3 || (i.status === -1 && a.items.some(other => other.status === 1)))) {
                    return true;
                }
                return false;
            });
        }
        const s = parseInt(statusStr, 10);
        return this.animes.filter(a => a.status === s);
    }

    /**
     * Filters the collection by a case-insensitive query matching franchise titles and sub-item titles.
     * @param {Array<Anime>} animes - The list of animes to filter.
     * @param {string} query - The search query string.
     * @returns {Array<Anime>} Filtered animes matching franchise or item titles.
     */
    static filterByQuery(animes, query) {
        if (!query || query.trim() === '') return animes;
        const q = query.toLowerCase().trim();
        return animes.filter(a => {
            if (a.title.toLowerCase().includes(q)) return true;
            return a.items && a.items.some(item => item.title && item.title.toLowerCase().includes(q));
        });
    }

    /**
     * Filters animes based on combined advanced options from the filter modal.
     * @param {Array<Anime>} animes - The list of animes to filter.
     * @param {Object} options - Selected filter criteria across dimensions.
     * @returns {Array<Anime>} Filtered animes.
     */
    static filterByAdvancedOptions(animes, options = {}) {
        if (!options || Object.keys(options).length === 0) return animes;

        return animes.filter(anime => {
            // 1. Item status filter (OR within selected item statuses)
            if (options.itemStatuses && options.itemStatuses.length > 0) {
                const itemStatusInts = options.itemStatuses.map(s => parseInt(s, 10));
                const hasMatchingItemStatus = anime.items.some(item => itemStatusInts.includes(item.status));
                if (!hasMatchingItemStatus) return false;
            }

            // 3. Item type filter (e.g. Serie, Movie, OVA, Special)
            if (options.itemTypes && options.itemTypes.length > 0) {
                const normalizedTypes = options.itemTypes.map(t => t.toLowerCase());
                const hasMatchingType = anime.items.some(item => item.type && normalizedTypes.includes(item.type.toLowerCase()));
                if (!hasMatchingType) return false;
            }

            // 4. Rating filter (min score or unrated)
            if (options.minRating !== undefined && options.minRating !== null && options.minRating > 0) {
                if ((anime.rating || 0) < options.minRating) return false;
            }
            if (options.ratingTiers && options.ratingTiers.length > 0) {
                const matchesTier = options.ratingTiers.some(tier => {
                    if (tier === 'nr') return !anime.rating || anime.rating === 0;
                    if (tier === 'high') return anime.rating >= 8.5;
                    if (tier === 'good') return anime.rating >= 7.0 && anime.rating < 8.5;
                    if (tier === 'avg') return anime.rating >= 5.0 && anime.rating < 7.0;
                    if (tier === 'low') return anime.rating > 0 && anime.rating < 5.0;
                    return true;
                });
                if (!matchesTier) return false;
            }

            // 5. Genres filter (OR or AND based on selection; matching any of selected genres)
            if (options.genres && options.genres.length > 0) {
                const hasMatchingGenre = options.genres.some(g => anime.genres && anime.genres.includes(g));
                if (!hasMatchingGenre) return false;
            }

            // 6. Studio filter
            if (options.studios && options.studios.length > 0) {
                if (!anime.studio || !options.studios.includes(anime.studio)) return false;
            }

            // 7. Year filter
            if (options.years && options.years.length > 0) {
                const yearInts = options.years.map(y => parseInt(y, 10));
                if (!anime.year || !yearInts.includes(anime.year)) return false;
            }

            // 8. Progress filter
            if (options.progress && options.progress.length > 0) {
                const matchesProgress = options.progress.some(p => {
                    if (p === 'unwatched_eps') {
                        return anime.items.some(i => i.episodesCount > 0 && i.watchedEpisodes.length < i.episodesCount && i.status !== 1 && i.status !== 2);
                    }
                    if (p === 'has_unstarted_items') {
                        return anime.items.some(i => i.status === -1);
                    }
                    if (p === 'has_in_progress_items') {
                        return anime.items.some(i => i.status === 0 || (i.watchedEpisodes && i.watchedEpisodes.length > 0 && i.watchedEpisodes.length < (i.episodesCount || 12)));
                    }
                    return true;
                });
                if (!matchesProgress) return false;
            }

            return true;
        });
    }

    /**
     * Extracts unique sorted genres from all loaded anime.
     * @returns {Array<string>} Unique genres list.
     */
    getUniqueGenres() {
        const genreSet = new Set();
        this.animes.forEach(a => {
            if (Array.isArray(a.genres)) {
                a.genres.forEach(g => { if (g && g.trim()) genreSet.add(g.trim()); });
            }
        });
        return Array.from(genreSet).sort();
    }

    /**
     * Extracts unique sorted studios from all loaded anime.
     * @returns {Array<string>} Unique studios list.
     */
    getUniqueStudios() {
        const studioSet = new Set();
        this.animes.forEach(a => {
            if (a.studio && a.studio.trim()) studioSet.add(a.studio.trim());
        });
        return Array.from(studioSet).sort();
    }

    /**
     * Extracts unique sorted years from all loaded anime in descending order.
     * @returns {Array<number>} Unique years list.
     */
    getUniqueYears() {
        const yearSet = new Set();
        this.animes.forEach(a => {
            if (a.year && !isNaN(a.year)) yearSet.add(a.year);
        });
        return Array.from(yearSet).sort((a, b) => b - a);
    }

    /**
     * Extracts unique item types (e.g. Serie, Movie, OVA) across all items.
     * @returns {Array<string>} Unique types list.
     */
    getUniqueItemTypes() {
        const typeSet = new Set();
        this.animes.forEach(a => {
            if (a.items) {
                a.items.forEach(i => {
                    if (i.type && i.type.trim()) {
                        const capitalized = i.type.trim().charAt(0).toUpperCase() + i.type.trim().slice(1);
                        typeSet.add(capitalized);
                    }
                });
            }
        });
        return Array.from(typeSet).sort();
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
            status: [-1, 0, 1, 4].includes(a.status) ? a.status : -1,
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

const apiCache = new Map();

/**
 * Small AniList GraphQL client for cover art and episode metadata.
 * Uses in-memory Map caching to eliminate duplicate GraphQL requests.
 */
export class AnilistApi {
    /**
     * Executes a cached GraphQL POST request against AniList with a 10s timeout.
     * Populates the module-level apiCache Map on success.
     */
    static async _fetch(cacheKey, query, variables) {
        if (apiCache.has(cacheKey)) return apiCache.get(cacheKey);
        try {
            const res = await fetch('https://graphql.anilist.co', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ query, variables }),
                signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined
            });
            if (!res.ok) return null;
            const data = await res.json();
            if (data.data && data.data.Media) {
                apiCache.set(cacheKey, data.data.Media);
                return data.data.Media;
            }
            return null;
        } catch (err) {
            console.error('Anilist API fetch failed for', cacheKey, err);
            return null;
        }
    }

    /**
     * Searches AniList by title text with in-memory caching.
     * @param {string} title - The anime title to search.
     * @returns {Promise<Object|null>} AniList media payload or null.
     */
    static async fetchMediaByTitle(title) {
        if (!title) return null;
        const cacheKey = `title:${title.trim().toLowerCase()}`;
        const query = `
        query ($search: String) {
          Media (search: $search, type: ANIME, sort: SEARCH_MATCH) {
            id
            title { romaji english }
            coverImage { large color }
            format
            episodes
          }
        }`;
        return this._fetch(cacheKey, query, { search: title });
    }

    /**
     * Fetches AniList media data by numeric id with in-memory caching.
     * @param {number|string} id - The numeric AniList ID.
     * @returns {Promise<Object|null>} AniList media payload or null.
     */
    static async fetchMediaById(id) {
        const parsedId = parseInt(id, 10);
        if (Number.isNaN(parsedId) || parsedId <= 0) return null;
        const cacheKey = `id:${parsedId}`;
        const query = `
        query ($id: Int) {
          Media (id: $id, type: ANIME) {
            id
            title { romaji english }
            coverImage { large color }
            format
            episodes
          }
        }`;
        return this._fetch(cacheKey, query, { id: parsedId });
    }
}

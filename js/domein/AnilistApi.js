const apiCache = new Map();

/**
 * Small AniList GraphQL client for cover art and episode metadata.
 * Uses in-memory Map caching to eliminate duplicate GraphQL requests.
 */
export class AnilistApi {
    /**
     * Searches AniList by title text with in-memory caching.
     * @param {string} title - The anime title to search.
     * @returns {Promise<Object|null>} AniList media payload or null.
     */
    static async fetchMediaByTitle(title) {
        if (!title) return null;
        const cacheKey = `title:${title.trim().toLowerCase()}`;
        if (apiCache.has(cacheKey)) {
            return apiCache.get(cacheKey);
        }

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

        const variables = { search: title };

        try {
            const res = await fetch('https://graphql.anilist.co', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({ query, variables })
            });

            if (!res.ok) {
                return null;
            }

            const data = await res.json();
            if (data.data && data.data.Media) {
                apiCache.set(cacheKey, data.data.Media);
                return data.data.Media;
            }
            return null;
        } catch (err) {
            console.error("Anilist API fetch failed for", title, err);
            return null;
        }
    }

    /**
     * Fetches AniList media data by numeric id with in-memory caching.
     * @param {number|string} id - The numeric AniList ID.
     * @returns {Promise<Object|null>} AniList media payload or null.
     */
    static async fetchMediaById(id) {
        if (!id) return null;
        const cacheKey = `id:${id}`;
        if (apiCache.has(cacheKey)) {
            return apiCache.get(cacheKey);
        }

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

        const variables = { id: parseInt(id) };

        try {
            const res = await fetch('https://graphql.anilist.co', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({ query, variables })
            });

            if (!res.ok) {
                return null;
            }

            const data = await res.json();
            if (data.data && data.data.Media) {
                apiCache.set(cacheKey, data.data.Media);
                return data.data.Media;
            }
            return null;
        } catch (err) {
            console.error("Anilist API fetch by ID failed for", id, err);
            return null;
        }
    }
}

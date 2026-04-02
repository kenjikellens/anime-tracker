// domein/AnilistApi.js

/**
 * AniList API module for tracking progress and fetching media data.
 * This module uses GraphQL to interact with the AniList v2 API.
 */
const TMDB_API_KEY = 'a341dc9a3c2dffa62668b614a98c1188';

var AnilistApi = {
    /**
     * Redirects the user to the AniList OAuth authorization page.
     * Starts the flow to obtain an access token.
     */
    authorize: function() {
        const url = `https://anilist.co/api/v2/oauth/authorize?client_id=${ANILIST_CLIENT_ID}&redirect_uri=${encodeURIComponent(ANILIST_REDIRECT_URI)}&response_type=code`;
        window.location.href = url;
    },

    /**
     * Fetches the authenticated user's entire anime list collection.
     * @async
     * @param {string} token - The OAuth access token for authentication.
     * @returns {Promise<Array<Object>>} A list of MediaList objects grouped by status (lists).
     * @throws {Error} If the viewer query or list query fails.
     */
    getUserList: async function(token) {
        const query = `
        query ($userId: Int) {
          MediaListCollection(userId: $userId, type: ANIME) {
            lists {
              name
              entries {
                status
                score(format: POINT_10)
                progress
                repeat
                media {
                  id
                  idMal
                  title {
                    romaji
                    english
                    native
                  }
                  episodes
                  format
                  status
                  averageScore
                  coverImage {
                    large
                  }
                }
              }
            }
          }
        }
        `;
        
        try {
            // First get the user ID
            const userQuery = `query { Viewer { id name } }`;
            const userRes = await fetch('https://graphql.anilist.co', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({ query: userQuery })
            });

            const userJson = await userRes.json();
            if (userJson.errors) {
                console.error('[AniList] Viewer query error:', userJson.errors);
                throw new Error(userJson.errors[0].message);
            }
            if (!userJson.data || !userJson.data.Viewer) {
                console.error('[AniList] Viewer not found. Check if your token is valid.');
                throw new Error('Viewer not found');
            }

            const viewer = userJson.data.Viewer;
            console.log(`[AniList] Verbonden als: ${viewer.name} (ID: ${viewer.id})`);

            const response = await fetch('https://graphql.anilist.co', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    query: query,
                    variables: { userId: viewer.id }
                })
            });

            const json = await response.json();
            if (json.errors) {
                console.error('[AniList] MediaListCollection query error:', json.errors);
                throw new Error(json.errors[0].message);
            }

            if (!json.data || !json.data.MediaListCollection) {
                console.warn('[AniList] Geen MediaListCollection gevonden.');
                return [];
            }

            const lists = json.data.MediaListCollection.lists;
            let totalEntries = 0;
            lists.forEach(l => totalEntries += l.entries.length);
            console.log(`[AniList] ${totalEntries} entries gevonden in ${lists.length} lijsten.`);
            
            return lists;
        } catch (error) {
            console.error('[AniList] Fout bij ophalen lijst:', error);
            throw error;
        }
    },

    /**
     * Updates an individual media list entry on AniList.
     * @async
     * @param {string} token - The OAuth access token.
     * @param {Object} data - The update parameters.
     * @param {number} data.mediaId - The AniList media ID to update.
     * @param {string} data.status - The new status (e.g., 'CURRENT', 'COMPLETED').
     * @param {number} data.progress - The number of episodes watched.
     * @param {number} [data.score] - The user score (1-10 format).
     * @returns {Promise<Object>} The updated entry data.
     */
    updateEntry: async function(token, data) {
        const mutation = `
        mutation ($mediaId: Int, $status: MediaListStatus, $progress: Int, $score: Float) {
          SaveMediaListEntry (mediaId: $mediaId, status: $status, progress: $progress, score: $score) {
            id
            status
            progress
          }
        }
        `;

        const response = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                query: mutation,
                variables: {
                    mediaId: parseInt(data.mediaId),
                    status: data.status,
                    progress: data.progress,
                    score: data.score
                }
            })
        });

        return await response.json();
    },

    /**
     * Updates multiple media list entries in a single batch request.
     * Uses GraphQL aliases (m0, m1...) to perform multiple mutations at once.
     * @async
     * @param {string} token - The OAuth access token.
     * @param {Array<Object>} items - Array of data objects {mediaId, status, progress, score}.
     * @returns {Promise<Object>} The batch results.
     */
    bulkUpdateEntries: async function(token, items) {
        if (!items || items.length === 0) return { data: {} };

        let mutationBody = "";
        const variables = {};

        items.forEach((data, index) => {
            const alias = `m${index}`;
            mutationBody += `
              ${alias}: SaveMediaListEntry (mediaId: $id${index}, status: $st${index}, progress: $pr${index}, score: $sc${index}) {
                id
                status
                progress
              }
            `;
            variables[`id${index}`] = parseInt(data.mediaId);
            variables[`st${index}`] = data.status;
            variables[`pr${index}`] = data.progress;
            variables[`sc${index}`] = data.score;
        });

        const fullMutation = `
          mutation (${items.map((_, i) => `$id${i}: Int, $st${i}: MediaListStatus, $pr${i}: Int, $sc${i}: Float`).join(', ')}) {
            ${mutationBody}
          }
        `;

        const response = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                query: fullMutation,
                variables: variables
            })
        });

        return await response.json();
    },

    /**
     * Searches for anime on AniList by a string query.
     * @async
     * @param {string} title - The title or search query.
     * @returns {Promise<Array<Object>>} A list of matching media results.
     */
    searchMedia: async function(title) {
        const query = `
        query ($search: String) {
          Page (page: 1, perPage: 10) {
            media (search: $search, type: ANIME) {
              id
              idMal
              title {
                romaji
                english
              }
              coverImage {
                large
              }
              format
              startDate {
                year
              }
            }
          }
        }
        `;

        const response = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                query: query,
                variables: { search: title }
            })
        });

        const json = await response.json();
        const results = json.data?.Page?.media;
        return results || [];
    },

    /**
     * Fetches comprehensive details for a specific AniList media object.
     * @async
     * @param {number} id - The AniList media ID.
     * @returns {Promise<Object|null>} Detailed media object or null if failed.
     */
    fetchMediaDetails: async function(id) {
        const query = `
        query ($id: Int) {
          Media (id: $id) {
            id
            idMal
            title {
              romaji
              english
            }
            format
            episodes
            status
            description
            startDate {
                year
                month
                day
            }
            coverImage {
              large
              extraLarge
            }
            bannerImage
            streamingEpisodes {
                title
                thumbnail
            }
          }
        }
        `;

        try {
            const response = await fetch('https://graphql.anilist.co', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    query: query,
                    variables: { id: id }
                })
            });

            const json = await response.json();
            if (json.errors) {
                console.error('[AniList] fetchMediaDetails error:', json.errors);
                return null;
            }
            return json.data?.Media || null;
        } catch (e) {
            console.error('[AniList] fetchMediaDetails network error:', e);
            return null;
        }
    },

    /**
     * Performs multiple anime searches in a single batched GraphQL query.
     * Useful for initial linking of local lists.
     * @async
     * @param {Array<string>} titles - Array of titles to search for.
     * @returns {Promise<Object>} Object containing results indexed by alias (s0, s1...).
     */
    bulkSearchMedia: async function(titles) {
        if (!titles || titles.length === 0) return { data: {} };

        let queryBody = "";
        const variables = {};

        titles.forEach((title, index) => {
            const alias = `s${index}`;
            queryBody += `
              ${alias}: Page (page: 1, perPage: 1) {
                media (search: $q${index}, type: ANIME) {
                  id
                  idMal
                  title {
                    romaji
                    english
                  }
                }
              }
            `;
            variables[`q${index}`] = title;
        });

        const fullQuery = `
          query (${titles.map((_, i) => `$q${i}: String`).join(', ')}) {
            ${queryBody}
          }
        `;

        const response = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                query: fullQuery,
                variables: variables
            })
        });

        return await response.json();
    },

    /**
     * Background utility that iterates over the local animeList to fill missing metadata.
     * Looks up AniList IDs if missing and fetches covers/descriptions.
     * Also performs a TMDB ID lookup strictly for video player compatibility.
     * @async
     * @returns {Promise<void>}
     */
    lazyFetchAnilistData: async function() {
        for (const item of state.animeList) {
            if (!item.poster_path || !item.anilist_id) {
                if (!item.anilist_id) {
                    const searchResults = await this.searchMedia(item.title);
                    if (searchResults && searchResults.length > 0) {
                        const best = searchResults[0];
                        item.anilist_id = best.id;
                        item.mal_id = best.idMal;
                        if (!item.poster_path) item.poster_path = best.coverImage.large;
                        save();
                    }
                }
                
                if (item.anilist_id && (!item.poster_path || !item.description)) {
                    const details = await this.fetchMediaDetails(item.anilist_id);
                    if (details) {
                        item.poster_path = details.coverImage.large;
                        item.description = details.description;
                        const date = details.startDate;
                        if (date && date.year) {
                            item.release_date = `${date.year}-${String(date.month || 1).padStart(2, '0')}-${String(date.day || 1).padStart(2, '0')}`;
                        }
                        
                        // Look up TMDB ID for video player compatibility
                        if (!item.tmdb_id) {
                            fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(item.title)}&language=en-US`)
                                .then(res => res.json())
                                .then(data => {
                                    if (data.results && data.results.length > 0) {
                                        item.tmdb_id = data.results[0].id;
                                        save();
                                    }
                                });
                        }
                        save();
                    }
                }
            }
        }
    },

    /**
     * Background utility that synchronizes episode counts and titles from AniList.
     * Maps AniList's "one season per media" model to RASCAL's "items/seasons" model.
     * Always uses the "Episode X" naming convention as per user requirements.
     * @async
     * @returns {Promise<void>}
     */
    lazySyncAnilistEpisodes: async function() {
        for (const item of state.animeList) {
            if (item.type === 'movie' || !item.anilist_id) continue;
            
            const status = window.StatusCalculator.getAnimeStatus(item);
            // Skip finished series to save API calls
            if (item.seasons && item.seasons.length > 0 && status === 1) continue; 

            const details = await this.fetchMediaDetails(item.anilist_id);
            if (!details) continue;

            if (!item.seasons) item.seasons = [];
            let s1 = item.seasons.find(s => s.number === 1);
            if (!s1) {
                s1 = { number: 1, name: 'Season 1', episodes: [] };
                item.seasons.push(s1);
            }

            const episodeCount = details.episodes || 0;
            if (s1.episodes.length < episodeCount) {
                console.log(`[AniList Sync] ${item.title}: Adding ${episodeCount - s1.episodes.length} episodes`);
                for (let i = s1.episodes.length + 1; i <= episodeCount; i++) {
                    s1.episodes.push({
                        number: i,
                        name: `Episode ${i}`, 
                        status: -1
                    });
                }
                save();
                if (typeof render === 'function') render();
            }
        }
    }
};

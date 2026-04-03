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
     * Fetches comprehensive details for a specific AniList media object, including relations.
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
            relations {
              edges {
                relationType(version: 2)
                node {
                  id
                  idMal
                  title {
                    romaji
                    english
                  }
                  type
                  format
                  episodes
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
     * Walks through the relations of a franchise and adds missing (non-crossover) media.
     * Uses a whitelist of relation types to prevent "Isekai Quartet" style pollution.
     * @async
     * @param {Object} franchise - The franchise object from state.animeList.
     * @returns {Promise<number>} Number of items added.
     */
    syncFranchise: async function(franchise) {
        if (!franchise || !franchise.items) return 0;
        
        console.log(`[AniList] Start franchise sync voor: ${franchise.name}`);
        const visited = new Set();
        // Add existing items to visited set
        franchise.items.forEach(it => { if (it.anilist_id) visited.add(it.anilist_id); });
        
        const queue = [...visited];
        let addedCount = 0;
        const allowedRelations = ['SEQUEL', 'PREQUEL', 'SIDE_STORY', 'ALTERNATIVE', 'PARENT', 'CONTAINS'];

        while (queue.length > 0) {
            const currentId = queue.shift();
            const details = await this.fetchMediaDetails(currentId);
            if (!details || !details.relations) continue;

            for (const edge of details.relations.edges) {
                const node = edge.node;
                const relType = edge.relationType;

                if (node.type !== 'ANIME') continue;
                if (!allowedRelations.includes(relType)) {
                    // console.log(`[AniList] Overslaan relatie ${relType} voor ${node.title.romaji} (Crossover preventie)`);
                    continue;
                }
                if (visited.has(node.id)) continue;

                visited.add(node.id);
                queue.push(node.id);

                const newItem = {
                    title: node.title.english || node.title.romaji,
                    anilist_id: node.id,
                    mal_id: node.idMal,
                    type: node.format === 'MOVIE' ? 'movie' : 'tv',
                    rating: -1,
                    poster_path: node.coverImage?.large
                };
                
                if (newItem.type === 'tv') {
                    newItem.seasons = [{ number: 1, name: 'Season 1', episodes: [] }];
                    const epCount = node.episodes || 0;
                    for (let i = 1; i <= epCount; i++) {
                        newItem.seasons[0].episodes.push({ number: i, name: `Episode ${i}`, status: -1 });
                    }
                } else if (newItem.type === 'movie') {
                    newItem.status = -1;
                }

                franchise.items.push(newItem);
                addedCount++;
                console.log(`[AniList] Gevonden: ${newItem.title} (${relType})`);
            }
        }
        
        if (addedCount > 0) {
            save();
            render();
        }
        return addedCount;
    },

    /**
     * Performs multiple anime searches in a single batched GraphQL query.
     * Useful for initial linking of local lists.
     * @async
     * @param {string} token
     * @param {Array<string>} titles - Array of titles to search for.
     * @returns {Promise<Object>} Object containing results indexed by alias (s0, s1...).
     */
    bulkSearchMedia: async function(token, titles) {
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
     * Updates to handle the 3-layer Franchise structure.
     * @async
     * @returns {Promise<void>}
     */
    lazyFetchAnilistData: async function() {
        for (const fr of state.animeList) {
            for (const item of fr.items) {
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
        }
    },

    /**
     * Background utility that synchronizes episode counts.
     * Updates to handle the 3-layer Franchise structure.
     * @async
     * @returns {Promise<void>}
     */
    lazySyncAnilistEpisodes: async function() {
        for (const fr of state.animeList) {
            for (const item of fr.items) {
                if (item.type === 'movie' || !item.anilist_id) continue;
                
                const status = window.StatusCalculator.getAnimeStatus(item);
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
    }
};
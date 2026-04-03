// domein/AnilistApi.js

/**
 * AniList API module voor voortgang, metadata en koppelingen.
 * Netwerkrequests lopen via kleine helpers zodat HTTP- en GraphQL-fouten
 * consequent worden afgevangen en gelogd.
 */
const TMDB_API_KEY = 'a341dc9a3c2dffa62668b614a98c1188';
const ANILIST_API_URL = 'https://graphql.anilist.co';

/**
 * Bouwt headers voor AniList requests.
 *
 * @param {string} [token]
 * @returns {Object}
 */
function buildAniListHeaders(token) {
    const headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json'
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    return headers;
}

/**
 * Zet een waarde veilig om naar een integer voor GraphQL parameters.
 *
 * @param {*} value
 * @returns {number|null}
 */
function toInteger(value) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Voert een AniList GraphQL request uit en gooit een fout bij HTTP- of API-fouten.
 *
 * @param {string} query
 * @param {Object} [variables={}]
 * @param {string} [token]
 * @returns {Promise<Object>}
 */
async function requestAniList(query, variables = {}, token) {
    const response = await fetch(ANILIST_API_URL, {
        method: 'POST',
        headers: buildAniListHeaders(token),
        body: JSON.stringify({ query, variables })
    });

    const json = await response.json();
    if (!response.ok) {
        const message = Array.isArray(json.errors) && json.errors[0]?.message
            ? json.errors[0].message
            : `${response.status} ${response.statusText}`;
        throw new Error(message);
    }

    if (json.errors) {
        throw new Error(json.errors.map((error) => error.message).join('; '));
    }

    return json.data || {};
}

/**
 * Zoekt een TMDB-id op voor playback-integraties.
 *
 * @param {string} title
 * @returns {Promise<number|null>}
 */
async function fetchTmdbId(title) {
    if (!title) {
        return null;
    }

    try {
        const response = await fetch(
            `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&language=en-US`
        );
        if (!response.ok) {
            console.warn(`[TMDB] Search mislukt voor "${title}" (${response.status}).`);
            return null;
        }

        const data = await response.json();
        return Array.isArray(data.results) && data.results[0]?.id ? data.results[0].id : null;
    } catch (error) {
        console.warn(`[TMDB] Search error voor "${title}":`, error);
        return null;
    }
}

var AnilistApi = {
    /**
     * Redirects the user to the AniList OAuth authorization page.
     *
     * @returns {void}
     */
    authorize: function() {
        const url = `https://anilist.co/api/v2/oauth/authorize?client_id=${ANILIST_CLIENT_ID}&redirect_uri=${encodeURIComponent(ANILIST_REDIRECT_URI)}&response_type=code`;
        window.location.href = url;
    },

    /**
     * Haalt de volledige AniList collection van de gebruiker op.
     *
     * @param {string} token
     * @returns {Promise<Array<Object>>}
     */
    getUserList: async function(token) {
        const listQuery = `
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
            const viewerData = await requestAniList('query { Viewer { id name } }', {}, token);
            if (!viewerData.Viewer) {
                throw new Error('Viewer not found');
            }

            const viewer = viewerData.Viewer;
            console.log(`[AniList] Verbonden als: ${viewer.name} (ID: ${viewer.id})`);

            const data = await requestAniList(listQuery, { userId: viewer.id }, token);
            const lists = Array.isArray(data.MediaListCollection?.lists) ? data.MediaListCollection.lists : [];
            const totalEntries = lists.reduce((count, list) => count + list.entries.length, 0);
            console.log(`[AniList] ${totalEntries} entries gevonden in ${lists.length} lijsten.`);
            return lists;
        } catch (error) {
            console.error('[AniList] Fout bij ophalen lijst:', error);
            throw error;
        }
    },

    /**
     * Werkt een enkele AniList entry bij.
     *
     * @param {string} token
     * @param {Object} data
     * @returns {Promise<Object>}
     */
    updateEntry: async function(token, data) {
        const mutation = `
            mutation ($mediaId: Int, $status: MediaListStatus, $progress: Int, $score: Float) {
                SaveMediaListEntry(mediaId: $mediaId, status: $status, progress: $progress, score: $score) {
                    id
                    status
                    progress
                }
            }
        `;

        const responseData = await requestAniList(
            mutation,
            {
                mediaId: toInteger(data.mediaId),
                status: data.status,
                progress: toInteger(data.progress) || 0,
                score: Number.isFinite(Number(data.score)) ? Number(data.score) : undefined
            },
            token
        );

        return responseData.SaveMediaListEntry;
    },

    /**
     * Werkt meerdere AniList entries in één batch bij.
     *
     * @param {string} token
     * @param {Array<Object>} items
     * @returns {Promise<Object>}
     */
    bulkUpdateEntries: async function(token, items) {
        if (!items || items.length === 0) {
            return { data: {} };
        }

        let mutationBody = '';
        const variables = {};

        items.forEach((item, index) => {
            mutationBody += `
                m${index}: SaveMediaListEntry(mediaId: $id${index}, status: $st${index}, progress: $pr${index}, score: $sc${index}) {
                    id
                    status
                    progress
                }
            `;
            variables[`id${index}`] = toInteger(item.mediaId);
            variables[`st${index}`] = item.status;
            variables[`pr${index}`] = toInteger(item.progress) || 0;
            variables[`sc${index}`] = Number.isFinite(Number(item.score)) ? Number(item.score) : null;
        });

        const mutation = `
            mutation (${items.map((_, index) => `$id${index}: Int, $st${index}: MediaListStatus, $pr${index}: Int, $sc${index}: Float`).join(', ')}) {
                ${mutationBody}
            }
        `;

        const data = await requestAniList(mutation, variables, token);
        return { data };
    },

    /**
     * Zoekt anime op titel.
     *
     * @param {string} title
     * @returns {Promise<Array<Object>>}
     */
    searchMedia: async function(title) {
        if (!title || !title.trim()) {
            return [];
        }

        const query = `
            query ($search: String) {
                Page(page: 1, perPage: 10) {
                    media(search: $search, type: ANIME) {
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

        try {
            const data = await requestAniList(query, { search: title.trim() });
            return Array.isArray(data.Page?.media) ? data.Page.media : [];
        } catch (error) {
            console.error('[AniList] searchMedia mislukt:', error);
            return [];
        }
    },

    /**
     * Haalt detailmetadata op voor een specifieke AniList media entry.
     *
     * @param {number} id
     * @returns {Promise<Object|null>}
     */
    fetchMediaDetails: async function(id) {
        if (!toInteger(id)) {
            return null;
        }

        const query = `
            query ($id: Int) {
                Media(id: $id) {
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
            const data = await requestAniList(query, { id: toInteger(id) });
            return data.Media || null;
        } catch (error) {
            console.error('[AniList] fetchMediaDetails error:', error);
            return null;
        }
    },

    /**
     * Zoekt meerdere titels in één GraphQL request.
     * Ondersteunt ook de oude call-shape `bulkSearchMedia(token, titles)`.
     *
     * @param {Array<string>|string} titlesOrLegacyArg
     * @param {Array<string>} [maybeTitles]
     * @returns {Promise<Object>}
     */
    bulkSearchMedia: async function(titlesOrLegacyArg, maybeTitles) {
        const titles = Array.isArray(titlesOrLegacyArg)
            ? titlesOrLegacyArg
            : Array.isArray(maybeTitles)
                ? maybeTitles
                : [];
        const cleanedTitles = titles.map((title) => String(title || '').trim()).filter(Boolean);

        if (cleanedTitles.length === 0) {
            return { data: {} };
        }

        let queryBody = '';
        const variables = {};

        cleanedTitles.forEach((title, index) => {
            queryBody += `
                s${index}: Page(page: 1, perPage: 1) {
                    media(search: $q${index}, type: ANIME) {
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

        const query = `
            query (${cleanedTitles.map((_, index) => `$q${index}: String`).join(', ')}) {
                ${queryBody}
            }
        `;

        try {
            const data = await requestAniList(query, variables);
            return { data };
        } catch (error) {
            console.error('[AniList] bulkSearchMedia error:', error);
            return { data: {} };
        }
    },

    /**
     * Vult ontbrekende AniList metadata op de achtergrond aan.
     *
     * @returns {Promise<void>}
     */
    lazyFetchAnilistData: async function() {
        for (const item of state.animeList) {
            if (!item || !item.title) {
                continue;
            }

            if (!item.poster_path || !item.anilist_id) {
                if (!item.anilist_id) {
                    const searchResults = await this.searchMedia(item.title);
                    if (searchResults.length > 0) {
                        const best = searchResults[0];
                        item.anilist_id = best.id;
                        item.mal_id = best.idMal;
                        if (!item.poster_path) {
                            item.poster_path = best.coverImage?.large || item.poster_path;
                        }
                        save();
                    }
                }

                if (item.anilist_id && (!item.poster_path || !item.description)) {
                    const details = await this.fetchMediaDetails(item.anilist_id);
                    if (details) {
                        item.poster_path = details.coverImage?.large || item.poster_path;
                        item.description = details.description || item.description;
                        const date = details.startDate;
                        if (date && date.year) {
                            item.release_date = `${date.year}-${String(date.month || 1).padStart(2, '0')}-${String(date.day || 1).padStart(2, '0')}`;
                        }

                        if (!item.tmdb_id) {
                            const tmdbId = await fetchTmdbId(item.title);
                            if (tmdbId) {
                                item.tmdb_id = tmdbId;
                            }
                        }
                        save();
                    }
                }
            }
        }
    },

    /**
     * Synchroniseert episode-aantallen vanuit AniList voor episodische items.
     *
     * @returns {Promise<void>}
     */
    lazySyncAnilistEpisodes: async function() {
        for (const item of state.animeList) {
            if (!item || item.type === 'movie' || !item.anilist_id) {
                continue;
            }

            const status = window.StatusCalculator.getAnimeStatus(item);
            if (item.seasons && item.seasons.length > 0 && status === 1) {
                continue;
            }

            const details = await this.fetchMediaDetails(item.anilist_id);
            if (!details) {
                continue;
            }

            if (!item.seasons) {
                item.seasons = [];
            }

            let firstSeason = item.seasons.find((season) => season.number === 1);
            if (!firstSeason) {
                firstSeason = { number: 1, name: 'Season 1', episodes: [] };
                item.seasons.push(firstSeason);
            }

            const episodeCount = Number.isFinite(Number(details.episodes)) ? Number(details.episodes) : 0;
            if (firstSeason.episodes.length < episodeCount) {
                console.log(`[AniList Sync] ${item.title}: Adding ${episodeCount - firstSeason.episodes.length} episodes`);
                for (let episodeNumber = firstSeason.episodes.length + 1; episodeNumber <= episodeCount; episodeNumber += 1) {
                    firstSeason.episodes.push({
                        number: episodeNumber,
                        name: `Episode ${episodeNumber}`,
                        status: -1
                    });
                }
                save();
                if (typeof render === 'function') {
                    render();
                }
            }
        }
    }
};

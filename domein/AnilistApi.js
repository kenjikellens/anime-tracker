// domein/AnilistApi.js

/**
 * AniList API module — enige databron voor RASCAL.
 * Alle anime-data wordt opgehaald en gemuteerd via de AniList GraphQL API.
 * Netwerkrequests lopen via kleine helpers zodat HTTP- en GraphQL-fouten
 * consequent worden afgevangen en gelogd.
 */
const TMDB_API_KEY = 'a341dc9a3c2dffa62668b614a98c1188';
const ANILIST_API_URL = 'https://graphql.anilist.co';

/**
 * Relation types die franchise-groepering toestaan.
 * Items verbonden via deze types worden in dezelfde franchise geplaatst.
 *
 * @type {Set<string>}
 */
const ACCEPTED_RELATION_TYPES = new Set([
    'SEQUEL', 'PREQUEL', 'SIDE_STORY', 'SPIN_OFF', 'ALTERNATIVE', 'PARENT'
]);

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
     * Haalt de volledige AniList collectie van de gebruiker op,
     * inclusief relaties voor franchise-groepering.
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
                            score(format: POINT_10_DECIMAL)
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
                                description(asHtml: false)
                                startDate {
                                    year
                                    month
                                    day
                                }
                                coverImage {
                                    large
                                    extraLarge
                                }
                                relations {
                                    edges {
                                        relationType
                                        node {
                                            id
                                        }
                                    }
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
     * Werkt een enkele AniList entry bij (status, progress, score).
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
                    score
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
                    description(asHtml: false)
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
     * Zoekt een TMDB-id op voor een titel (voor playback).
     *
     * @param {string} title
     * @returns {Promise<number|null>}
     */
    fetchTmdbId: fetchTmdbId,

    /**
     * Geeft de set van geaccepteerde relatie-types terug voor franchise-groepering.
     *
     * @returns {Set<string>}
     */
    getAcceptedRelationTypes: function() {
        return ACCEPTED_RELATION_TYPES;
    }
};

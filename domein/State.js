// domein/State.js

/**
 * Leest JSON uit localStorage zonder de app te laten crashen bij corrupte data.
 *
 * @param {string} key
 * @param {*} fallback
 * @returns {*}
 */
function readStoredJson(key, fallback) {
    try {
        const rawValue = localStorage.getItem(key);
        return rawValue ? JSON.parse(rawValue) : fallback;
    } catch (error) {
        console.warn(`[State] Kon localStorage sleutel "${key}" niet lezen:`, error);
        return fallback;
    }
}

/**
 * Boolean die aangeeft of de applicatie draait op GitHub Pages.
 * In die modus bewaren we wijzigingen lokaal in de browser.
 *
 * @type {boolean}
 */
var isGitHub = window.location.hostname.includes('github.io');

/**
 * AniList API credentials.
 *
 * @type {string}
 */
var ANILIST_CLIENT_ID = '38391';
var ANILIST_CLIENT_SECRET = 'jYd6Wg0vRohTyVkYr3KIYOriM6J9gAa3enD246ux';
var ANILIST_REDIRECT_URI = 'http://localhost:3000/callback';

/**
 * Globale applicatiestatus.
 * Houdt alle geladen anime-items en runtime-meta bij.
 *
 * @type {{ animeList: Array<Object>, anilistToken?: string }}
 */
var state = { animeList: [] };

/**
 * Actieve statusfilters voor de lijstweergave.
 *
 * @type {Set<number>}
 */
var activeFilters = new Set(
    (Array.isArray(readStoredJson('rascal_filters', [-1, 0, 1]))
        ? readStoredJson('rascal_filters', [-1, 0, 1])
        : [-1, 0, 1]
    ).map((value) => Number.parseInt(value, 10)).filter((value) => [-1, 0, 1].includes(value))
);

/**
 * Actuele zoekterm.
 *
 * @type {string}
 */
var currentSearch = '';

/**
 * Actuele sorteervolgorde.
 *
 * @type {string}
 */
var currentSort = localStorage.getItem('rascal_sort') || 'default';

/**
 * Huidige weergavemodus.
 *
 * @type {string}
 */
var currentView = localStorage.getItem('rascal_view') || 'grid';

/**
 * Kaartgrootte in gridweergave.
 *
 * @type {string}
 */
var currentSize = localStorage.getItem('rascal_size') || 'm';

/**
 * Registreert welke seizoenen opengeklapt zijn.
 *
 * @type {Set<string>}
 */
var expandedSeasons = new Set();

/**
 * Selectie van afleveringen voor batchacties.
 *
 * @type {Map<string, Object>}
 */
var selectedEpisodes = new Map();

/**
 * De groep die momenteel in de detailmodal wordt getoond.
 *
 * @type {Object|null}
 */
var currentlyShownItem = null;

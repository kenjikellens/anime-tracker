// domein/State.js

/**
 * Boolean die aangeeft of de applicatie draait op GitHub Pages.
 * Dit bepaalt of we in 'read-only' modus zitten waarbij data via localStorage wordt bewaard,
 * in plaats van de Python backend (/save endpoint) te gebruiken.
 * @type {boolean}
 */
var isGitHub = window.location.hostname.includes('github.io');

/**
 * AniList API credentials.
 * @type {string}
 */
var ANILIST_CLIENT_ID = '38391';
var ANILIST_CLIENT_SECRET = 'jYd6Wg0vRohTyVkYr3KIYOriM6J9gAa3enD246ux';
var ANILIST_REDIRECT_URI = 'http://localhost:3000/callback';

/**
 * Globale applicatiestatus.
 * Bevat onder andere de hoofd database (`animeList`) met alle films en series.
 * @type {{ animeList: Array<Object> }}
 */
var state = { animeList: [] };

/**
 * Set met actieve statusfilters. Bepaalt welke items zichtbaar zijn.
 * Mogelijke geselecteerde statussen: -1 (Te Bekijken), 0 (Bezig), 1 (Bekeken).
 * Gelaad via localStorage om state tussen sessies te onthouden.
 * @type {Set<number>}
 */
var activeFilters = new Set(JSON.parse(localStorage.getItem('rascal_filters')) || [-1, 0, 1]);

/**
 * De momenteel actieve zoekopdracht (string). De lijst filtert direct (live)
 * op items met titels die deze tekenreeks bevatten.
 * @type {string}
 */
var currentSearch = '';

/**
 * De actieve sorteerlogica voor de weergavelijst.
 * Mogelijke waarden: 'default', 'title-asc', 'title-desc', 'rating-desc', 'rating-asc', 'status'.
 * @type {string}
 */
var currentSort = localStorage.getItem('rascal_sort') || 'default';

/**
 * Huidige weergavemodus van de interface. Weergegeven als grote blokken ('grid') 
 * of als compacte regels ('list'). Opgeslagen in localStorage.
 * @type {string}
 */
var currentView = localStorage.getItem('rascal_view') || 'grid';

/**
 * De gespecificeerde grootte van elementen in de view (small, medium, large).
 * Hoofdzakelijk gebruikt voor de breedte van kaarten in grid-view.
 * @type {string}
 */
var currentSize = localStorage.getItem('rascal_size') || 'm';

/**
 * Registreert welke specifieke seizoenen inline zijn uitgeklapt (detail view / list view).

 * Sleutel formaat is "Titel-S1" of "Titel-S2".
 * @type {Set<string>}
 */
var expandedSeasons = new Set();

/**
 * Geselecteerde afleveringen via Ctrl+Klik voor batch operaties (meerdere tegelijk als 'Bekeken' markeren).
 * @type {Map<string, Object>} Key: "titel|Sn|En" - Value: { item, season, episode } referentie object.
 */
var selectedEpisodes = new Map();

/**
 * Wijst op het anime-item of de franchise-groep die actueel wordt bekeken
 * in het popup/detail-paneel in grid-view.  Nul als deze gesloten is.
 * @type {Object|null}
 */
var currentlyShownItem = null;


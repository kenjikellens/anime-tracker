// app.js - Central Domain Controller
// AniList is de enige databron. Geen lokale data.json meer.

const ANILIST_STATUS_MAP = {
    '-1': 'PLANNING',
    '0': 'CURRENT',
    '1': 'COMPLETED'
};

/**
 * Leest een DOM-element veilig op.
 *
 * @param {string} id
 * @returns {HTMLElement|null}
 */
function getElementByIdOrWarn(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.warn(`[app] Element "${id}" niet gevonden.`);
    }
    return element;
}

/**
 * Registreert een event listener als het doelelement bestaat.
 *
 * @param {string} id
 * @param {string} eventName
 * @param {Function} handler
 * @returns {void}
 */
function addListenerIfPresent(id, eventName, handler) {
    const element = getElementByIdOrWarn(id);
    if (element) {
        element.addEventListener(eventName, handler);
    }
}

/**
 * Wacht een korte tijd tussen batchcalls.
 *
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/**
 * Haalt JSON op en valideert de HTTP-response.
 *
 * @param {string} url
 * @param {RequestInit} [options]
 * @param {string} [context='Request']
 * @returns {Promise<*>}
 */
async function fetchJson(url, options = {}, context = 'Request') {
    const response = await fetch(url, options);
    if (!response.ok) {
        throw new Error(`${context} mislukt (${response.status} ${response.statusText})`);
    }
    return response.json();
}

/**
 * Mapt een AniList MediaListStatus naar een RASCAL macrostatus.
 *
 * @param {string} anilistStatus
 * @returns {number}
 */
function mapAniListStatusToRascal(anilistStatus) {
    return window.AnimeActions.toRascalStatus(anilistStatus);
}

/**
 * Mapt een AniList format naar een RASCAL type.
 *
 * @param {string} format - AniList format (TV, MOVIE, OVA, ONA, SPECIAL, etc.)
 * @returns {string}
 */
function mapAniListFormat(format) {
    switch (format) {
        case 'MOVIE': return 'movie';
        case 'OVA': return 'tv';
        case 'ONA': return 'tv';
        case 'SPECIAL': return 'tv';
        case 'TV_SHORT': return 'tv';
        default: return 'tv';
    }
}

/**
 * Mapt een AniList format naar een leesbaar label.
 *
 * @param {string} format
 * @returns {string}
 */
function formatLabel(format) {
    switch (format) {
        case 'TV': return 'Serie';
        case 'TV_SHORT': return 'Short';
        case 'MOVIE': return 'Film';
        case 'OVA': return 'OVA';
        case 'ONA': return 'ONA';
        case 'SPECIAL': return 'Special';
        default: return format || 'Serie';
    }
}

/**
 * Convertert de AniList collectie naar RASCAL items.
 * Elk AniList MediaList entry wordt één RASCAL item.
 *
 * @param {Array<Object>} lists - AniList MediaListCollection lists
 * @returns {Array<Object>}
 */
function mapAniListEntriesToRascal(lists) {
    const items = [];
    const seenIds = new Set();

    lists.forEach((list) => {
        if (!Array.isArray(list.entries)) return;

        list.entries.forEach((entry) => {
            const media = entry.media;
            if (!media || seenIds.has(media.id)) return;
            seenIds.add(media.id);

            const title = media.title?.english || media.title?.romaji || media.title?.native || 'Onbekend';
            const rascalStatus = mapAniListStatusToRascal(entry.status);
            const score = entry.score > 0 ? entry.score : -1;
            const startDate = media.startDate;
            const releaseDate = startDate?.year
                ? `${startDate.year}-${String(startDate.month || 1).padStart(2, '0')}-${String(startDate.day || 1).padStart(2, '0')}`
                : null;

            // Relaties opslaan voor franchise-groepering
            const relations = [];
            if (media.relations?.edges) {
                media.relations.edges.forEach((edge) => {
                    relations.push({
                        type: edge.relationType,
                        targetId: edge.node?.id
                    });
                });
            }

            items.push({
                title: title,
                anilist_id: media.id,
                mal_id: media.idMal,
                type: mapAniListFormat(media.format),
                _format: formatLabel(media.format),
                _anilistStatus: entry.status,
                _rascalStatus: rascalStatus,
                progress: entry.progress || 0,
                episodes: media.episodes || null,
                rating: score,
                poster_path: media.coverImage?.extraLarge || media.coverImage?.large || null,
                description: media.description || null,
                release_date: releaseDate,
                tmdb_id: null, // Wordt lazy opgehaald
                _relations: relations
            });
        });
    });

    console.log(`[Mapping] ${items.length} AniList entries omgezet naar RASCAL items.`);
    return items;
}

/**
 * Haalt het AniList token op uit config (lokaal) of localStorage (GitHub Pages).
 *
 * @returns {Promise<string>}
 */
async function resolveToken() {
    // GitHub Pages: token uit localStorage
    if (isGitHub) {
        return localStorage.getItem('rascal_anilist_token') || '';
    }

    // Lokaal: config.json via backend
    try {
        const config = await fetchJson('/config', {}, 'Config laden');
        const token = typeof config?.anilist_token === 'string' ? config.anilist_token : '';
        if (token) {
            localStorage.setItem('rascal_anilist_token', token);
        }
        return token;
    } catch (error) {
        console.warn('[app] Config laden mislukt, fallback naar localStorage:', error);
        return localStorage.getItem('rascal_anilist_token') || '';
    }
}

/**
 * Laadt de anime-data vanuit AniList en start de render.
 *
 * @returns {Promise<void>}
 */
async function init() {
    try {
        const token = await resolveToken();
        if (!token) {
            console.warn('[app] Geen AniList token gevonden. Login vereist.');
            state.animeList = [];
            Modals.initEventListeners();
            render();
            return;
        }

        state.anilistToken = token;
        console.log('[app] AniList token gevonden, data ophalen...');

        const lists = await AnilistApi.getUserList(token);
        state.animeList = mapAniListEntriesToRascal(lists);

    } catch (error) {
        console.error('[app] AniList data laden mislukt:', error);
        state.animeList = [];
    }

    Modals.initEventListeners();
    render();

    // Lazy: TMDB-ids ophalen voor playback
    lazyFetchTmdbIds();
}

/**
 * Haalt TMDB-ids op voor items die er nog geen hebben (voor playback).
 * Wordt op de achtergrond uitgevoerd na de eerste render.
 *
 * @returns {Promise<void>}
 */
async function lazyFetchTmdbIds() {
    for (const item of state.animeList) {
        if (item.tmdb_id || !item.title) continue;

        try {
            const tmdbId = await AnilistApi.fetchTmdbId(item.title);
            if (tmdbId) {
                item.tmdb_id = tmdbId;
            }
        } catch (error) {
            // Silently continue
        }

        // Rate limiting
        await sleep(200);
    }
}

/**
 * Herbouwt de volledige UI op basis van de huidige state.
 *
 * @returns {void}
 */
function render() {
    const container = getElementByIdOrWarn('anime-container');
    if (!container) {
        return;
    }

    container.className = `${currentView}-view size-${currentSize}`;
    container.innerHTML = '';

    const items = getFilteredSorted();
    const statusGroups = {
        '0': { label: 'Bezig', icon: 'fas fa-play', items: [] },
        '-1': { label: 'Te Bekijken', icon: 'fas fa-clock', items: [] },
        '1': { label: 'Bekeken', icon: 'fas fa-check', items: [] }
    };

    items.forEach((wrapper) => {
        const status = String(wrapper._computedStatus);
        if (statusGroups[status]) {
            statusGroups[status].items.push(wrapper);
        }
    });

    ['0', '-1', '1'].forEach((statusKey) => {
        const group = statusGroups[statusKey];
        if (group.items.length === 0) {
            return;
        }

        const column = document.createElement('div');
        column.className = `status-column status-col-${statusKey}`;

        const header = document.createElement('div');
        header.className = 'status-group-header';
        header.innerHTML = `<i class="${group.icon}"></i> <span>${group.label}</span> <span class="group-count">${group.items.length}</span>`;
        column.appendChild(header);

        group.items.forEach((franchiseGroup) => {
            column.appendChild(Components.buildCard(franchiseGroup, franchiseGroup._computedStatus));
        });

        container.appendChild(column);
    });

    const itemCount = getElementByIdOrWarn('item-count');
    if (itemCount) {
        itemCount.textContent = `${items.length} titels getoond`;
    }

    document.querySelectorAll('.filter-btn').forEach((button) => {
        const filterValue = button.dataset.filter;
        button.classList.toggle(
            'active',
            filterValue === 'all'
                ? activeFilters.size === 3
                : activeFilters.has(Number.parseInt(filterValue, 10))
        );
    });

    const searchInput = getElementByIdOrWarn('search-input');
    if (searchInput && searchInput.value !== currentSearch) {
        searchInput.value = currentSearch;
    }

    const gridButton = getElementByIdOrWarn('grid-btn');
    const listButton = getElementByIdOrWarn('list-btn');
    if (gridButton) {
        gridButton.classList.toggle('active', currentView === 'grid');
    }
    if (listButton) {
        listButton.classList.toggle('active', currentView === 'list');
    }

    document.querySelectorAll('.size-btn').forEach((button) => {
        button.classList.toggle('active', button.dataset.size === currentSize);
    });

    const sortSelect = getElementByIdOrWarn('sort-select');
    if (sortSelect) {
        sortSelect.value = currentSort;
    }
}

/**
 * Synchroniseert status, score en voortgang van een item met AniList.
 *
 * @param {Object} item
 * @returns {Promise<void>}
 */
async function triggerAutoSync(item) {
    if (!item || !state.anilistToken || !item.anilist_id) {
        return;
    }

    try {
        await AnilistApi.updateEntry(state.anilistToken, {
            mediaId: item.anilist_id,
            status: item._anilistStatus || 'PLANNING',
            progress: item.progress || 0,
            score: item.rating > 0 ? item.rating : undefined
        });
    } catch (error) {
        console.warn(`[AniList] Sync mislukt voor ${item.title}:`, error);
    }
}

/**
 * Wijzigt de status van een volledig item en triggert AniList autosync.
 *
 * @param {Object} item
 * @param {number} status
 * @returns {void}
 */
function setAnimeAllStatus(item, status) {
    window.AnimeActions.setStatusLocally(item, status);
    triggerAutoSync(item);
}

/**
 * Voert een volledige herlaad van AniList data uit (vervangt oude syncAnilist).
 *
 * @returns {Promise<void>}
 */
async function syncAnilist() {
    if (!state.anilistToken) {
        AnilistApi.authorize();
        return;
    }

    const button = getElementByIdOrWarn('sync-anilist-btn');
    if (button) {
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        button.disabled = true;
    }

    try {
        console.log('[Sync] Volledige AniList herlaad...');
        const lists = await AnilistApi.getUserList(state.anilistToken);
        state.animeList = mapAniListEntriesToRascal(lists);
        render();
        alert(`Sync voltooid! ${state.animeList.length} items geladen vanuit AniList.`);
    } catch (error) {
        console.error('Sync failed:', error);
        alert(`Oei! Sync mislukt: ${error.message}`);
    } finally {
        if (button) {
            button.innerHTML = '<i class="fa-brands fa-anilist"></i>';
            button.disabled = false;
        }
    }
}

// --- Theme ---

/**
 * Initialiseert het UI-thema op basis van user- of systeemvoorkeur.
 *
 * @returns {void}
 */
function initTheme() {
    const manualTheme = localStorage.getItem('rascal_theme');
    const canObserveSystemTheme = typeof window.matchMedia === 'function';
    const systemTheme = canObserveSystemTheme && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    applyTheme(manualTheme || systemTheme);

    if (!canObserveSystemTheme) {
        return;
    }

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
        if (!localStorage.getItem('rascal_theme')) {
            applyTheme(event.matches ? 'dark' : 'light');
        }
    });
}

/**
 * Past een specifiek thema toe op de applicatie.
 *
 * @param {string} theme
 * @returns {void}
 */
function applyTheme(theme) {
    const supportedThemes = new Set(['light', 'dark', 'midnight']);
    const nextTheme = supportedThemes.has(theme) ? theme : 'light';
    document.documentElement.setAttribute('data-theme', nextTheme);

    const toggle = getElementByIdOrWarn('theme-toggle');
    const icon = toggle ? toggle.querySelector('i') : null;
    if (icon) {
        icon.className = nextTheme === 'light'
            ? 'fas fa-moon'
            : nextTheme === 'dark'
                ? 'fas fa-star'
                : 'fas fa-sun';
    }
}

/**
 * Registreert alle globale event listeners.
 *
 * @returns {void}
 */
function initEventListeners() {
    document.querySelectorAll('.filter-btn').forEach((button) => {
        button.addEventListener('click', () => {
            const filterValue = button.dataset.filter;
            if (filterValue === 'all') {
                activeFilters = new Set([-1, 0, 1]);
                currentSearch = '';
            } else {
                const status = Number.parseInt(filterValue, 10);
                if (activeFilters.has(status)) {
                    activeFilters.delete(status);
                } else {
                    activeFilters.add(status);
                }
            }
            localStorage.setItem('rascal_filters', JSON.stringify([...activeFilters]));
            render();
        });
    });

    document.querySelectorAll('.size-btn').forEach((button) => {
        button.addEventListener('click', () => {
            currentSize = button.dataset.size || 'm';
            localStorage.setItem('rascal_size', currentSize);
            render();
        });
    });

    addListenerIfPresent('sort-select', 'change', (event) => {
        currentSort = event.target.value;
        localStorage.setItem('rascal_sort', currentSort);
        render();
    });

    addListenerIfPresent('grid-btn', 'click', () => {
        currentView = 'grid';
        localStorage.setItem('rascal_view', currentView);
        render();
    });

    addListenerIfPresent('list-btn', 'click', () => {
        currentView = 'list';
        localStorage.setItem('rascal_view', currentView);
        render();
    });

    addListenerIfPresent('search-input', 'input', (event) => {
        currentSearch = event.target.value.trim();
        render();
    });
    addListenerIfPresent('sync-anilist-btn', 'click', syncAnilist);
    addListenerIfPresent('download-btn', 'click', exportData);
    addListenerIfPresent('theme-toggle', 'click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const nextTheme = currentTheme === 'light' ? 'dark' : currentTheme === 'dark' ? 'midnight' : 'light';
        localStorage.setItem('rascal_theme', nextTheme);
        applyTheme(nextTheme);
    });

    document.addEventListener('click', () => {
        if (window.Components?.closeGlobalStatusMenu) {
            window.Components.closeGlobalStatusMenu();
            return;
        }

        const globalMenu = document.getElementById('global-status-menu');
        if (globalMenu) {
            globalMenu.style.display = 'none';
        }
        document.querySelectorAll('.anime-card.has-open-dropdown').forEach((card) => card.classList.remove('has-open-dropdown'));
    });
}

// Start
initTheme();
initEventListeners();
init();

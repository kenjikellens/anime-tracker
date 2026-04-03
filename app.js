// app.js - Central Domain Controller

const VALID_STATUSES = new Set([-1, 0, 1]);
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
 * Normaliseert een statuswaarde.
 *
 * @param {*} status
 * @param {number} [fallback=-1]
 * @returns {number}
 */
function normalizeStatus(status, fallback = -1) {
    const parsed = Number.parseInt(status, 10);
    return VALID_STATUSES.has(parsed) ? parsed : fallback;
}

/**
 * Detecteert of een item afleveringsdata hoort te gebruiken.
 *
 * @param {Object} item
 * @returns {boolean}
 */
function isEpisodeBasedItem(item) {
    return Boolean(item) && item.type !== 'movie';
}

/**
 * Normaliseert een aflevering zodat render- en statuslogica veilige defaults heeft.
 *
 * @param {Object} episode
 * @param {number} index
 * @returns {Object}
 */
function normalizeEpisode(episode, index) {
    const episodeNumber = Number.isFinite(Number(episode?.number))
        ? Number(episode.number)
        : index + 1;

    return {
        ...episode,
        number: episodeNumber,
        name: typeof episode?.name === 'string' && episode.name.trim()
            ? episode.name.trim()
            : `Episode ${episodeNumber}`,
        status: normalizeStatus(episode?.status, -1)
    };
}

/**
 * Normaliseert een seizoen zodat latere code veilig op `episodes` kan rekenen.
 *
 * @param {Object} season
 * @param {number} index
 * @returns {Object}
 */
function normalizeSeason(season, index) {
    const seasonNumber = Number.isFinite(Number(season?.number))
        ? Number(season.number)
        : index + 1;
    const episodes = Array.isArray(season?.episodes) ? season.episodes : [];

    return {
        ...season,
        number: seasonNumber,
        name: typeof season?.name === 'string' && season.name.trim()
            ? season.name.trim()
            : seasonNumber === 0
                ? 'Specials'
                : `Season ${seasonNumber}`,
        episodes: episodes.map(normalizeEpisode)
    };
}

/**
 * Normaliseert een anime-item naar een consistent runtime-formaat.
 *
 * @param {Object} item
 * @returns {Object|null}
 */
function normalizeAnimeItem(item) {
    if (!item || typeof item !== 'object') {
        return null;
    }

    const title = typeof item.title === 'string' ? item.title.trim() : '';
    if (!title) {
        return null;
    }

    const type = typeof item.type === 'string' ? item.type.toLowerCase() : 'tv';
    const numericRating = Number(item.rating);

    item.title = title;
    item.type = type || 'tv';
    item.rating = Number.isFinite(numericRating) && numericRating > 0 ? numericRating : -1;

    if (item.status !== undefined) {
        item.status = normalizeStatus(item.status, -1);
    }
    if (item._legacyStatus !== undefined) {
        item._legacyStatus = normalizeStatus(item._legacyStatus, -1);
    }

    if (Array.isArray(item.seasons)) {
        item.seasons = item.seasons.map(normalizeSeason);
    } else if (isEpisodeBasedItem(item)) {
        item.seasons = [];
    }

    return item;
}

/**
 * Past datamigraties toe op oudere items.
 *
 * @param {Object} item
 * @returns {boolean} `true` als de migratie een save vereist.
 */
function migrateAnimeItem(item) {
    let needsSave = false;

    if (item.rating === 0 || item.rating === undefined || item.rating === null) {
        item.rating = -1;
        needsSave = true;
    }

    if (isEpisodeBasedItem(item) && Array.isArray(item.seasons) && item.seasons.length > 0) {
        if (item.status !== undefined) {
            delete item.status;
            needsSave = true;
        }
    } else if (isEpisodeBasedItem(item)) {
        if (item.status !== undefined && item.status !== -1 && item._legacyStatus === undefined) {
            item._legacyStatus = item.status;
            needsSave = true;
        }
        if (item.status !== undefined) {
            delete item.status;
            needsSave = true;
        }
    }

    return needsSave;
}

/**
 * Converteert een franchise-gegroepeerde datastructuur naar losse items.
 *
 * @param {Array<Object>} remoteData
 * @returns {Array<Object>}
 */
function flattenFranchiseDataIfNeeded(remoteData) {
    if (!Array.isArray(remoteData) || remoteData.length === 0) {
        return [];
    }

    if (!(remoteData[0].items && remoteData[0].name)) {
        return remoteData;
    }

    console.log('[Migration] Geneste franchise-structuur gedetecteerd, flattening wordt toegepast.');

    const flattened = [];
    remoteData.forEach((franchise) => {
        const items = Array.isArray(franchise.items) ? franchise.items : [];
        items.forEach((item) => {
            item.franchise = franchise.name;
            ['poster_path', 'tmdb_id', 'anilist_id', 'mal_id', 'description', 'release_date', 'rating'].forEach((key) => {
                if (
                    franchise[key] !== undefined &&
                    franchise[key] !== null &&
                    (item[key] === undefined || item[key] === null || item[key] === -1)
                ) {
                    item[key] = franchise[key];
                }
            });
            flattened.push(item);
        });
    });

    return flattened;
}

/**
 * Bepaalt welke lijst als bron gebruikt moet worden bij het opstarten.
 *
 * @param {Array<Object>} remoteData
 * @returns {Array<Object>}
 */
function resolveInitialAnimeList(remoteData) {
    if (!isGitHub) {
        return remoteData;
    }

    const localData = localStorage.getItem('rascal_data');
    if (!localData) {
        return remoteData;
    }

    try {
        const parsed = JSON.parse(localData);
        if (Array.isArray(parsed)) {
            if (typeof updateDownloadButtonState === 'function') {
                updateDownloadButtonState(true);
            }
            return parsed;
        }
    } catch (error) {
        console.warn('[app] Lokale browserdata is ongeldig, remote data wordt gebruikt.', error);
    }

    return remoteData;
}

/**
 * Normaliseert titels voor matching- en duplicate-checks.
 *
 * @param {string} value
 * @returns {string}
 */
function normalizeTitle(value) {
    return String(value || '').trim().toLowerCase();
}

/**
 * Controleert of een lokaal item overeenkomt met een AniList mediarecord.
 *
 * @param {Object} item
 * @param {Object} media
 * @returns {boolean}
 */
function matchesAniListMedia(item, media) {
    const itemTitle = normalizeTitle(item?.title);
    const romajiTitle = normalizeTitle(media?.title?.romaji);
    const englishTitle = normalizeTitle(media?.title?.english);

    return Boolean(
        (item?.mal_id && media?.idMal === item.mal_id) ||
        (itemTitle && (itemTitle === romajiTitle || itemTitle === englishTitle))
    );
}

/**
 * Telt het aantal bekeken afleveringen of filmvoortgang.
 *
 * @param {Object} item
 * @returns {number}
 */
function getItemProgress(item) {
    if (Array.isArray(item?.seasons)) {
        return item.seasons.reduce((total, season) => {
            const watchedCount = Array.isArray(season.episodes)
                ? season.episodes.filter((episode) => episode.status === 1).length
                : 0;
            return total + watchedCount;
        }, 0);
    }

    return item?.type === 'movie' && item.status === 1 ? 1 : 0;
}

/**
 * Zet de lokale status om naar AniList-status.
 *
 * @param {Object} item
 * @returns {string}
 */
function getAniListStatus(item) {
    const macroStatus = window.StatusCalculator.getAnimeStatus(item);
    return ANILIST_STATUS_MAP[String(macroStatus)] || 'PLANNING';
}

/**
 * Laadt de anime-data, voert migraties uit en start de render.
 *
 * @returns {Promise<void>}
 */
async function init() {
    try {
        if (!isGitHub) {
            const config = await fetchJson('/config', {}, 'Config laden');
            state.anilistToken = typeof config?.anilist_token === 'string' ? config.anilist_token : '';
            console.log('Config geladen:', state.anilistToken ? 'AniList verbonden' : 'Geen AniList');
        }

        const remoteData = flattenFranchiseDataIfNeeded(await fetchJson('data.json', {}, 'data.json laden'));
        const initialList = resolveInitialAnimeList(Array.isArray(remoteData) ? remoteData : []);

        state.animeList = initialList
            .map(normalizeAnimeItem)
            .filter(Boolean);

        let needsSave = false;
        state.animeList.forEach((item) => {
            if (migrateAnimeItem(item)) {
                needsSave = true;
            }
        });

        if (needsSave) {
            await save();
        }
    } catch (error) {
        console.error('Kon data.json niet laden:', error);
        state.animeList = [];
    }

    Modals.initEventListeners();
    render();
    AnilistApi.lazyFetchAnilistData();
    AnilistApi.lazySyncAnilistEpisodes();
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
 * Wijzigt de status van een seizoen en triggert AniList autosync.
 *
 * @param {Object} item
 * @param {Object} season
 * @param {number} status
 * @returns {void}
 */
function setSeasonStatus(item, season, status) {
    window.AnimeActions.setSeasonStatusLocally(item, season, status);
    triggerAutoSync(item);
}

/**
 * Wijzigt de status van een volledig item en triggert AniList autosync.
 *
 * @param {Object} item
 * @param {number} status
 * @returns {void}
 */
function setAnimeAllStatus(item, status) {
    window.AnimeActions.setAnimeStatusLocally(item, status);
    triggerAutoSync(item);
}

/**
 * Wijzigt de status van een enkele aflevering en triggert AniList autosync.
 *
 * @param {Object} item
 * @param {Object} season
 * @param {Object} episode
 * @param {number} status
 * @returns {void}
 */
function setEpisodeStatus(item, season, episode, status) {
    window.AnimeActions.setEpisodeStatusLocally(item, season, episode, status);
    triggerAutoSync(item);
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
            status: getAniListStatus(item),
            progress: getItemProgress(item),
            score: item.rating > 0 ? item.rating : undefined
        });
    } catch (error) {
        console.warn(`[AniList] Sync mislukt voor ${item.title}:`, error);
    }
}

/**
 * Voert een volledige bidirectionele sync met AniList uit.
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
        console.log('Fetching AniList collections...');
        const lists = await AnilistApi.getUserList(state.anilistToken);

        let linkedCount = 0;
        let pushedCount = 0;
        let addedFromAniList = 0;
        let totalOnAniList = 0;
        const aniListEntries = [];

        lists.forEach((list) => {
            totalOnAniList += list.entries.length;
            aniListEntries.push(...list.entries);
        });

        const needsLinking = state.animeList.filter((item) => {
            if (item.anilist_id) {
                return false;
            }

            const match = aniListEntries.find((entry) => matchesAniListMedia(item, entry.media));
            if (match) {
                item.anilist_id = match.media.id;
                item.mal_id = match.media.idMal;
                linkedCount += 1;
                return false;
            }

            return true;
        });

        if (needsLinking.length > 0) {
            console.log(`[Batch] Searching for ${needsLinking.length} unlinked items...`);
            for (let index = 0; index < needsLinking.length; index += 10) {
                const chunk = needsLinking.slice(index, index + 10);
                const result = await AnilistApi.bulkSearchMedia(chunk.map((item) => item.title));
                if (result.data) {
                    chunk.forEach((item, chunkIndex) => {
                        const media = result.data[`s${chunkIndex}`]?.media?.[0];
                        if (media) {
                            item.anilist_id = media.id;
                            item.mal_id = media.idMal;
                            linkedCount += 1;
                        }
                    });
                }
                await sleep(600);
            }
        }

        for (const item of state.animeList) {
            if (item.anilist_id) {
                await triggerAutoSync(item);
                pushedCount += 1;
            }
        }

        for (const entry of aniListEntries) {
            const media = entry.media;
            const exists = state.animeList.find((item) => item.anilist_id === media.id || matchesAniListMedia(item, media));
            if (exists) {
                continue;
            }

            const newItem = normalizeAnimeItem({
                title: media.title.english || media.title.romaji,
                anilist_id: media.id,
                mal_id: media.idMal,
                type: media.format === 'MOVIE' ? 'movie' : 'tv',
                rating: entry.score > 0 ? entry.score : -1
            });

            if (!newItem) {
                continue;
            }

            if (entry.status === 'COMPLETED') {
                newItem._anilist_force_completed = true;
            } else if (entry.status === 'CURRENT' && entry.progress > 0) {
                newItem._anilist_progress = entry.progress;
            }

            state.animeList.unshift(newItem);
            addedFromAniList += 1;

            (async () => {
                const details = await AnilistApi.fetchMediaDetails(newItem.anilist_id);
                if (!details) {
                    return;
                }

                newItem.poster_path = details.coverImage?.large || newItem.poster_path;
                if (newItem.type === 'tv') {
                    newItem.seasons = [{ number: 1, name: 'Season 1', episodes: [] }];
                    const episodeCount = Number.isFinite(Number(details.episodes)) ? Number(details.episodes) : 0;
                    for (let episodeNumber = 1; episodeNumber <= episodeCount; episodeNumber += 1) {
                        newItem.seasons[0].episodes.push({ number: episodeNumber, name: `Episode ${episodeNumber}`, status: -1 });
                    }

                    if (newItem._anilist_force_completed) {
                        window.AnimeActions.setAnimeStatusLocally(newItem, 1);
                        delete newItem._anilist_force_completed;
                    } else if (newItem._anilist_progress > 0) {
                        let count = 0;
                        for (const episode of newItem.seasons[0].episodes) {
                            if (count < newItem._anilist_progress) {
                                episode.status = 1;
                                count += 1;
                            }
                        }
                        delete newItem._anilist_progress;
                    }
                } else if (newItem.type === 'movie' && newItem._anilist_force_completed) {
                    newItem.status = 1;
                    delete newItem._anilist_force_completed;
                }

                save();
                render();
            })();
        }

        save();
        render();
        alert(
            `Sync voltooid!\n\nAniList Status:\n- ${totalOnAniList} items gevonden op je account\n- ${addedFromAniList} nieuwe titels geimporteerd naar RASCAL\n\nRASCAL Updates:\n- ${pushedCount} lokale items gesynchroniseerd\n- ${linkedCount} nieuwe koppelingen gemaakt`
        );
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

/**
 * Pusht alle lokale items met AniList-id in batches.
 *
 * @returns {Promise<void>}
 */
async function pushAllToAnilist() {
    if (!state.anilistToken) {
        AnilistApi.authorize();
        return;
    }

    const button = getElementByIdOrWarn('push-anilist-btn');
    const original = button ? button.innerHTML : '';
    if (button) {
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        button.disabled = true;
    }

    try {
        let linkedCount = 0;
        const toSync = [];
        const needsLinking = state.animeList.filter((item) => !item.anilist_id);

        if (needsLinking.length > 0) {
            console.log(`[Batch Push-Link] Searching for ${needsLinking.length} items...`);
            for (let index = 0; index < needsLinking.length; index += 10) {
                const chunk = needsLinking.slice(index, index + 10);
                const result = await AnilistApi.bulkSearchMedia(chunk.map((item) => item.title));
                if (result.data) {
                    chunk.forEach((item, chunkIndex) => {
                        const media = result.data[`s${chunkIndex}`]?.media?.[0];
                        if (media) {
                            item.anilist_id = media.id;
                            item.mal_id = media.idMal;
                            linkedCount += 1;
                        }
                    });
                }
                await sleep(600);
            }
        }

        state.animeList.forEach((item) => {
            if (!item.anilist_id) {
                return;
            }

            toSync.push({
                mediaId: item.anilist_id,
                status: getAniListStatus(item),
                progress: getItemProgress(item),
                score: item.rating > 0 ? item.rating : undefined
            });
        });

        for (let index = 0; index < toSync.length; index += 20) {
            const chunk = toSync.slice(index, index + 20);
            console.log(`[Batch Push-Update] Sending chunk ${Math.floor(index / 20) + 1} (${chunk.length} items)...`);
            await AnilistApi.bulkUpdateEntries(state.anilistToken, chunk);
            await sleep(1000);
        }

        save();
        render();
        alert(`Klaar!\n- ${toSync.length} items naar AniList gesynct\n- ${linkedCount} nieuwe items gekoppeld.`);
    } catch (error) {
        console.error('Push failed:', error);
        alert(`Oei! Batch push mislukt: ${error.message}`);
    } finally {
        if (button) {
            button.innerHTML = original || '<i class="fas fa-cloud-upload-alt"></i>';
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
    addListenerIfPresent('push-anilist-btn', 'click', pushAllToAnilist);
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

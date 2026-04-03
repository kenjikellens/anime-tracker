// app.js - Central Domain Controller
// Koppelingen:
// - State.js: globale state (`state`, `currentView`, filters, etc.)
// - ListTransformer.js: `getFilteredSorted()`
// - Components.js / Modals.js: opbouw en interactie van UI
// - AnimeActions.js / StatusCalculator.js: domeinlogica rond status/progress
// - Storage.js: `save()` en `exportData()`
// - AnilistApi.js: OAuth, sync en metadata-updates

/**
 * Laadt de anime-data, voert migrations uit en start de render.
 */
async function init() {
    try {
        if (!isGitHub) {
            const configRes = await fetch('/config');
            const config = await configRes.json();
            state.anilistToken = config.anilist_token;
            console.log('Config geladen:', state.anilistToken ? 'AniList Verbonden' : 'Geen AniList');
        }

        const res = await fetch('data.json');
        let remoteData = await res.json();

        // [MIGRATION] Flatten nested franchise structure if detected
        if (Array.isArray(remoteData) && remoteData.length > 0 && remoteData[0].items && remoteData[0].name) {
            console.log('[Migration] Detecting nested franchise structure, flattening...');
            const flatData = [];
            remoteData.forEach(fr => {
                const frItems = Array.isArray(fr.items) ? fr.items : [];
                frItems.forEach(it => {
                    it.franchise = fr.name;
                    // Copy over extra fields from franchise object (e.g. from user edits) if item lacks them
                    ['poster_path', 'tmdb_id', 'anilist_id', 'mal_id', 'description', 'release_date', 'rating'].forEach(key => {
                        if (fr[key] !== undefined && fr[key] !== null && (it[key] === undefined || it[key] === null || it[key] === -1)) {
                            it[key] = fr[key];
                        }
                    });
                    flatData.push(it);
                });
            });
            remoteData = flatData;
        }
        
        if (isGitHub) {
            const localData = localStorage.getItem('rascal_data');
            if (localData) {
                state.animeList = JSON.parse(localData);
                document.getElementById('download-btn').classList.remove('hidden');
                document.getElementById('download-btn').classList.add('sync-needed');
            } else {
                state.animeList = remoteData;
            }
        } else {
            state.animeList = remoteData;
        }

        // Data migrations
        let needsSave = false;
        state.animeList.forEach(item => {
            if (item.rating === 0 || item.rating === undefined || item.rating === null) item.rating = -1;
            if (item.seasons && item.seasons.length > 0) {
                if (item.status !== undefined) { delete item.status; needsSave = true; }
            } else if (item.type !== 'movie') {
                if (item.status !== undefined && item.status !== -1) item._legacyStatus = item.status;
                delete item.status;
                needsSave = true;
            }
        });
        if (needsSave) save();
    } catch (e) {
        console.error('Kon data.json niet laden:', e);
        state.animeList = [];
    }
    
    Modals.initEventListeners();
    render();
    AnilistApi.lazyFetchAnilistData();
    AnilistApi.lazySyncAnilistEpisodes();
}

/**
 * Herbouwt de volledige UI op basis van de huidige state.
 */
function render() {
    const container = document.getElementById('anime-container');
    container.className = `${currentView}-view size-${currentSize}`;
    container.innerHTML = '';

    const items = getFilteredSorted();
    const statusGroups = {
        '0': { label: 'Bezig', icon: 'fas fa-play', items: [] },
        '-1': { label: 'Te Bekijken', icon: 'fas fa-clock', items: [] },
        '1': { label: 'Bekeken', icon: 'fas fa-check', items: [] }
    };

    items.forEach(wrapper => {
        const status = String(wrapper._computedStatus);
        if (statusGroups[status]) statusGroups[status].items.push(wrapper);
    });

    const order = ['0', '-1', '1'];
    order.forEach(statusKey => {
        const group = statusGroups[statusKey];
        if (group.items.length === 0) return;

        const column = document.createElement('div');
        column.className = `status-column status-col-${statusKey}`;

        const header = document.createElement('div');
        header.className = 'status-group-header';
        header.innerHTML = `<i class="${group.icon}"></i> <span>${group.label}</span> <span class="group-count">${group.items.length}</span>`;
        column.appendChild(header);

        group.items.forEach(fr => {
            column.appendChild(Components.buildCard(fr, fr._computedStatus));
        });
        container.appendChild(column);
    });

    document.getElementById('item-count').textContent = `${items.length} titels getoond`;

    // Filter Buttons Sync
    document.querySelectorAll('.filter-btn').forEach(btn => {
        const f = btn.dataset.filter;
        btn.classList.toggle('active', f === 'all' ? activeFilters.size === 3 : activeFilters.has(parseInt(f)));
    });

    const sInput = document.getElementById('search-input');
    if (sInput.value !== currentSearch) sInput.value = currentSearch;

    // View & Size Buttons Sync
    document.getElementById('grid-btn').classList.toggle('active', currentView === 'grid');
    document.getElementById('list-btn').classList.toggle('active', currentView === 'list');
    document.querySelectorAll('.size-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.size === currentSize);
    });
    
    document.getElementById('sort-select').value = currentSort;
}

// --- Sync Helpers ---

/**
 * Updates the status of a specific season within an anime item.
 * @param {Object} item - The target anime object.
 * @param {Object} season - The target season object.
 * @param {number} status - The new status to set (-1, 0, 1).
 */
function setSeasonStatus(item, season, status) {
    window.AnimeActions.setSeasonStatusLocally(item, season, status);
    triggerAutoSync(item);
}

/**
 * Updates the overall status of an anime item (cascading to all episodes).
 * @param {Object} item - The target anime object.
 * @param {number} status - The new status to set (-1, 0, 1).
 */
function setAnimeAllStatus(item, status) {
    window.AnimeActions.setAnimeStatusLocally(item, status);
    triggerAutoSync(item);
}

/**
 * Updates the status of a single episode.
 * @param {Object} item - The target anime object.
 * @param {Object} season - The target season object.
 * @param {Object} episode - The target episode object.
 * @param {number} status - The new status to set (-1, 0, 1).
 */
function setEpisodeStatus(item, season, episode, status) {
    window.AnimeActions.setEpisodeStatusLocally(item, season, episode, status);
    triggerAutoSync(item);
}

/**
 * Automatically pushes the current status, progress, and score of an item to AniList.
 * Only works if an AniList token and ID are present.
 * @async
 * @param {Object} item - The anime item to sync.
 * @returns {Promise<void>}
 */
async function triggerAutoSync(item) {
    if (!state.anilistToken || !item.anilist_id) return;
    
    let progress = 0;
    if (item.seasons) {
        item.seasons.forEach(s => s.episodes.forEach(ep => { if (ep.status === 1) progress++; }));
    } else if (item.type === 'movie' && item.status === 1) {
        progress = 1;
    }

    const macroStatus = window.StatusCalculator.getAnimeStatus(item);
    const alStatusMap = { '1': 'COMPLETED', '0': 'CURRENT', '-1': 'PLANNING' };
    
    try {
        await AnilistApi.updateEntry(state.anilistToken, {
            mediaId: item.anilist_id,
            status: alStatusMap[macroStatus],
            progress: progress,
            score: (item.rating && item.rating > 0) ? item.rating : undefined
        });
    } catch (e) {
        console.warn(`[AniList] Sync failed for ${item.title}:`, e);
    }
}

/**
 * Performs a comprehensive synchronization with the user's AniList account.
 * Links local items with AniList IDs, pushes local statuses, and imports new items from AniList.
 * @async
 */
async function syncAnilist() {
    if (!state.anilistToken) { AnilistApi.authorize(); return; }

    const btn = document.getElementById('sync-anilist-btn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    btn.disabled = true;

    try {
        console.log('Fetching AniList collections...');
        const lists = await AnilistApi.getUserList(state.anilistToken);
        
        let linkedCount = 0, pushedCount = 0, addedFromAl = 0, totalOnAniList = 0;
        const alEntries = [];
        lists.forEach(l => {
            totalOnAniList += l.entries.length;
            alEntries.push(...l.entries);
        });

        // 1. LINK & COLLECT
        const needsLinking = state.animeList.filter(item => {
            if (item.anilist_id) return false;
            const match = alEntries.find(e => 
                (item.mal_id && e.media.idMal === item.mal_id) ||
                (item.title.toLowerCase() === e.media.title.romaji.toLowerCase()) ||
                (item.title.toLowerCase() === (e.media.title.english || '').toLowerCase())
            );
            if (match) {
                item.anilist_id = match.media.id;
                item.mal_id = match.media.idMal;
                return false;
            }
            return true;
        });

        if (needsLinking.length > 0) {
            console.log(`[Batch] Searching for ${needsLinking.length} unlinked items...`);
            const searchBatchSize = 10;
            for (let i = 0; i < needsLinking.length; i += searchBatchSize) {
                const chunk = needsLinking.slice(i, i + searchBatchSize);
                const res = await AnilistApi.bulkSearchMedia(state.anilistToken, chunk.map(it => it.title));
                if (res.data) {
                    chunk.forEach((item, idx) => {
                        const media = res.data[`s${idx}`]?.media?.[0];
                        if (media) {
                            item.anilist_id = media.id;
                            item.mal_id = media.idMal;
                            linkedCount++;
                        }
                    });
                }
                await new Promise(r => setTimeout(r, 600));
            }
        }

        // 2. PUSH STATUSES
        for (const item of state.animeList) {
            if (item.anilist_id) {
                await triggerAutoSync(item);
                pushedCount++;
            }
        }

        // 3. IMPORT
        for (const entry of alEntries) {
            const media = entry.media;
            const exists = state.animeList.find(it => it.anilist_id === media.id || it.title.toLowerCase() === media.title.romaji.toLowerCase() || (media.title.english && it.title.toLowerCase() === media.title.english.toLowerCase()));
            
            if (!exists) {
                const newItem = { 
                    title: media.title.english || media.title.romaji, 
                    anilist_id: media.id, 
                    mal_id: media.idMal, 
                    type: media.format === 'MOVIE' ? 'movie' : 'tv', 
                    rating: entry.score > 0 ? entry.score : -1 
                };
                if (entry.status === 'COMPLETED') newItem._anilist_force_completed = true;
                else if (entry.status === 'CURRENT' && entry.progress > 0) newItem._anilist_progress = entry.progress;
                
                state.animeList.unshift(newItem);
                addedFromAl++;
                
                // Fetch AniList data in background
                (async () => {
                    const details = await AnilistApi.fetchMediaDetails(newItem.anilist_id);
                    if (details) {
                        newItem.poster_path = details.coverImage.large;
                        if (newItem.type === 'tv') {
                            newItem.seasons = [{ number: 1, name: 'Season 1', episodes: [] }];
                            const epCount = details.episodes || 0;
                            for (let i = 1; i <= epCount; i++) {
                                newItem.seasons[0].episodes.push({ number: i, name: `Episode ${i}`, status: -1 });
                            }
                            
                            if (newItem._anilist_force_completed) { window.AnimeActions.setAnimeStatusLocally(newItem, 1); delete newItem._anilist_force_completed; }
                            else if (newItem._anilist_progress > 0) {
                                let count = 0;
                                for (const ep of newItem.seasons[0].episodes) { if (count < newItem._anilist_progress) { ep.status = 1; count++; } }
                                delete newItem._anilist_progress;
                            }
                        } else if (newItem.type === 'movie' && newItem._anilist_force_completed) { newItem.status = 1; delete newItem._anilist_force_completed; }
                        save(); render();
                    }
                })();
            }
        }

        save();
        render();
        alert(`Sync voltooid!\n\nAniList Status:\n- ${totalOnAniList} items gevonden op je account\n- ${addedFromAl} nieuwe titels geïmporteerd naar RASCAL\n\nRASCAL Updates:\n- ${pushedCount} lokalen items gesynchroniseerd\n- ${linkedCount} nieuwe koppelingen gemaakt\n\nBekijk de console (F12) voor details! Nya~! 🐾`);
    } catch (error) {
        console.error('Sync failed:', error);
        alert(`Oei! Sync mislukt: ${error.message}\n\nKijk in de console voor details! Nya~! 🐾`);
    } finally { btn.innerHTML = '<i class="fa-brands fa-anilist"></i>'; btn.disabled = false; }
}

/**
 * Pushes all local items with AniList IDs to the user's AniList account in batches.
 * @async
 */
async function pushAllToAnilist() {
    if (!state.anilistToken) { AnilistApi.authorize(); return; }
    const btn = document.getElementById('push-anilist-btn');
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    btn.disabled = true;

    try {
        let linkedCount = 0;
        const toSync = [];

        // 1. Linking Phase (BATCHED)
        const needsLinking = state.animeList.filter(it => !it.anilist_id);
        if (needsLinking.length > 0) {
            console.log(`[Batch Push-Link] Searching for ${needsLinking.length} items...`);
            const chunkSearch = 10;
            for (let i = 0; i < needsLinking.length; i += chunkSearch) {
                const chunk = needsLinking.slice(i, i + chunkSearch);
                const res = await AnilistApi.bulkSearchMedia(state.anilistToken, chunk.map(it => it.title));
                if (res.data) {
                    chunk.forEach((item, idx) => {
                        const media = res.data[`s${idx}`]?.media?.[0];
                        if (media) {
                            item.anilist_id = media.id;
                            item.mal_id = media.idMal;
                            linkedCount++;
                        }
                    });
                }
                await new Promise(r => setTimeout(r, 600));
            }
        }

        // 2. Collect for Batching
        for (const item of state.animeList) {
            if (item.anilist_id) {
                const macroStatus = window.StatusCalculator.getAnimeStatus(item);
                const alStatusMap = { '1': 'COMPLETED', '0': 'CURRENT', '-1': 'PLANNING' };
                let progress = 0;
                if (item.seasons) {
                    item.seasons.forEach(s => s.episodes.forEach(ep => { if (ep.status === 1) progress++; }));
                } else if (item.type === 'movie' && item.status === 1) {
                    progress = 1;
                }

                toSync.push({
                    mediaId: item.anilist_id,
                    status: alStatusMap[macroStatus],
                    progress: progress,
                    score: (item.rating && item.rating > 0) ? item.rating : undefined
                });
            }
        }

        // 3. Batch Push Phase
        const chunkSize = 20;
        for (let i = 0; i < toSync.length; i += chunkSize) {
            const chunk = toSync.slice(i, i + chunkSize);
            console.log(`[Batch Push-Update] Sending chunk ${Math.floor(i/chunkSize) + 1} (${chunk.length} items)...`);
            await AnilistApi.bulkUpdateEntries(state.anilistToken, chunk);
            await new Promise(r => setTimeout(r, 1000));
        }

        save(); render();
        alert(`Klaar! \n- ${toSync.length} items naar AniList gesinkt (alles gebatched!).\n- ${linkedCount} nieuwe items gekoppeld. \nNya~! ✨`);
    } catch (e) {
        console.error('Push failed:', e);
        alert('Oei! Iets ging mis tijdens de batch push. Controleer je verbinding! Nya~! 🐾');
    } finally {
        btn.innerHTML = original;
        btn.disabled = false;
    }
}

/**
 * Voegt een nieuw anime-item toe op basis van het invoerveld in de header.
 * Koppeling:
 * - Schrijft naar `state.animeList` (State.js),
 * - laat verrijking over aan `AnilistApi.lazyFetchAnilistData()`,
 * - persisted via `save()` en triggert `render()`.
 *
 * @returns {void}
 */
function addNew() {
    const input = document.getElementById('new-anime-input');
    const val = input.value.trim();
    if (val) {
        // We voegen het item direct toe, AniListApi.lazyFetchAnilistData doet de rest op de achtergrond.
        state.animeList.unshift({ title: val, status: -1, rating: -1, type: 'tv' });
        input.value = '';
        save(); render();
    }
}

// --- Theme ---

/**
 * Initializes the UI theme based on user preference or system settings.
 */
function initTheme() {
    const manual = localStorage.getItem('rascal_theme');
    let theme = manual || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    applyTheme(theme);
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        if (!localStorage.getItem('rascal_theme')) applyTheme(e.matches ? 'dark' : 'light');
    });
}

/**
 * Applies a specific theme to the application.
 * @param {string} theme - The theme name ('light', 'dark', 'midnight').
 */
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const icon = document.getElementById('theme-toggle').querySelector('i');
    icon.className = theme === 'light' ? 'fas fa-moon' : theme === 'dark' ? 'fas fa-star' : 'fas fa-sun';
}

// --- Event Listeners ---

/**
 * Registreert filterknoppen voor statusfiltering.
 * Koppeling:
 * - Leest/schrijft `activeFilters` (State.js),
 * - bewaart voorkeur in `localStorage`,
 * - herbouwt de UI via `render()`.
 */
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const f = btn.dataset.filter;
        if (f === 'all') { activeFilters = new Set([-1, 0, 1]); currentSearch = ''; }
        else {
            const status = parseInt(f);
            if (activeFilters.has(status)) activeFilters.delete(status); else activeFilters.add(status);
        }
        localStorage.setItem('rascal_filters', JSON.stringify([...activeFilters]));
        render();
    });
});

/**
 * Registreert maatknoppen voor kaartgrootte.
 * Koppeling: `currentSize` (State.js) + `render()`.
 */
document.querySelectorAll('.size-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentSize = btn.dataset.size;
        localStorage.setItem('rascal_size', currentSize);
        render();
    });
});

/**
 * Registreert sorteerselectie.
 * Koppeling: `currentSort` (State.js) + `render()`.
 */
document.getElementById('sort-select').addEventListener('change', e => { 
    currentSort = e.target.value; 
    localStorage.setItem('rascal_sort', currentSort);
    render(); 
});


/**
 * View-switch events (grid/list).
 * Koppeling: `currentView` (State.js) + `render()`.
 */
document.getElementById('grid-btn').addEventListener('click', () => { currentView = 'grid'; localStorage.setItem('rascal_view', currentView); render(); });
document.getElementById('list-btn').addEventListener('click', () => { currentView = 'list'; localStorage.setItem('rascal_view', currentView); render(); });

/**
 * Header-interacties en globale acties.
 * Koppelingen:
 * - `addNew`, `syncAnilist`, `pushAllToAnilist`,
 * - `exportData` (Storage.js),
 * - thema-wissel via `applyTheme`.
 */
document.getElementById('add-btn').addEventListener('click', addNew);
document.getElementById('new-anime-input').addEventListener('keypress', e => { if (e.key === 'Enter') addNew(); });
document.getElementById('search-input').addEventListener('input', e => { currentSearch = e.target.value.trim(); render(); });
document.getElementById('sync-anilist-btn').addEventListener('click', syncAnilist);
document.getElementById('push-anilist-btn').addEventListener('click', pushAllToAnilist);
document.getElementById('download-btn').addEventListener('click', exportData);
document.getElementById('theme-toggle').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'light' ? 'dark' : current === 'dark' ? 'midnight' : 'light';
    localStorage.setItem('rascal_theme', next); applyTheme(next);
});

/**
 * Globale klikhandler voor het sluiten van openstaande contextmenu's/dropdowns.
 * Koppeling: gebruikt `#global-status-menu` uit de UI-componentlaag.
 */
document.addEventListener('click', () => {
    const globalMenu = document.getElementById('global-status-menu');
    if (globalMenu) globalMenu.style.display = 'none';
    document.querySelectorAll('.anime-card.has-open-dropdown').forEach(c => c.classList.remove('has-open-dropdown'));
});

// Start
initTheme();
init();

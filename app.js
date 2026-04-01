const TMDB_API_KEY = 'a341dc9a3c2dffa62668b614a98c1188';
const isGitHub = window.location.hostname.includes('github.io');

let state = { animeList: [] };
let activeFilters = new Set(JSON.parse(localStorage.getItem('rascal_filters')) || [-1, 0, 1, 2]); // Alle statussen standaard aan
let currentSearch = '';
let currentSort = 'default';
let currentView = localStorage.getItem('rascal_view') || 'grid';
let currentSize = localStorage.getItem('rascal_size') || 'm'; // s, m, l
let expandedItems = new Set(); // set van anime titels die zijn uitgeklapt
let expandedSeasons = new Set(); // welke seizoenen zijn uitgeklapt (key: "title-S1")
let selectedEpisodes = new Map(); // key: "title|S|E", value: { item, season, episode }
let currentlyShownItem = null; // item in de geopende detail modal

// --- Init ---

async function init() {
    try {
        const res = await fetch('data.json');
        let remoteData = await res.json();
        
        if (isGitHub) {
            const localData = localStorage.getItem('rascal_data');
            if (localData) {
                state.animeList = JSON.parse(localData);
                document.getElementById('download-btn').classList.remove('hidden');
                document.getElementById('download-btn').classList.add('sync-needed');
                console.log('Geladen vanuit localStorage (GitHub mode)');
            } else {
                state.animeList = remoteData;
            }
        } else {
            state.animeList = remoteData;
        }
        let needsSave = false;
        state.animeList.forEach(item => {
            // Migreer oude '0' beoordelingen naar '-1' (onbeoordeeld)
            if (item.rating === 0 || item.rating === undefined || item.rating === null) {
                item.rating = -1;
            }
            // Status migratie: verwijder redundant item.status
            if (item.seasons && item.seasons.length > 0) {
                // Item heeft seizoendata — status wordt berekend uit afleveringen
                if (item.status !== undefined) {
                    delete item.status;
                    needsSave = true;
                }
            } else if (item.type !== 'movie') {
                // Item zonder seizoendata — bewaar legacy status voor eerste ophaal
                // Als er al een _legacyStatus is, overschrijf deze alleen als status zinvol is
                if (item.status !== undefined && item.status !== -1) {
                    item._legacyStatus = item.status;
                }
                delete item.status;
                needsSave = true;
            }

        });
        if (needsSave) save();
    } catch (e) {
        console.error('Kon data.json niet laden:', e);
        state.animeList = [];
    }
    render();
    // Start op de achtergrond het ophalen van missende posters
    lazyFetchPosters();
    // Start op de achtergrond seizoen-sync voor nieuwe seizoenen
    lazySyncSeasons();
}

async function lazyFetchPosters() {
    for (const item of state.animeList) {
        if (!item.poster_path) {
            await fetchTmdbId(item);
        }
    }
}

async function lazySyncSeasons() {
    for (const item of state.animeList) {
        if (item.type === 'movie') continue;
        if (item.manual_seasons) continue;
        // OOK syncen als seasons nog ontbreken (voor eerste migratie)
        if (!item.tmdb_id) continue;


        const oldStatus = window.StatusCalculator.getAnimeStatus(item);
        await fetchSeasonData(item);
        const newStatus = window.StatusCalculator.getAnimeStatus(item);
        if (oldStatus !== newStatus) {
            console.log(`[Sync] ${item.title}: status ${oldStatus} → ${newStatus}`);
            render();
        }
    }
}

async function save() {
    try {
        if (isGitHub) {
            // Sla op in localStorage en markeer als 'sync nodig'
            localStorage.setItem('rascal_data', JSON.stringify(state.animeList));
            const dlBtn = document.getElementById('download-btn');
            dlBtn.classList.remove('hidden');
            dlBtn.classList.add('sync-needed');
            console.log('Opgeslagen in localStorage (GitHub mode)');
        } else {
            await fetch('/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(state.animeList, null, 2)
            });
        }
    } catch (e) {
        console.error('Opslaan mislukt:', e);
    }
}

function exportData() {
    const dataStr = JSON.stringify(state.animeList, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'data.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Na downloaden de pulse weghalen
    document.getElementById('download-btn').classList.remove('sync-needed');
}

// --- TMDB ---

async function fetchTmdbId(item) {
    if (item.tmdb_id && item.poster_path) return { id: item.tmdb_id, type: item.type };
    try {
        const res = await fetch(
            `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(item.title)}&language=en-US`
        );
        const data = await res.json();
        if (data.results && data.results.length > 0) {
            const best = data.results[0];
            item.tmdb_id = best.id;
            item.type = best.media_type === 'movie' ? 'movie' : 'tv';
            item.poster_path = best.poster_path;
            item.release_date = best.release_date || best.first_air_date;
            save();
            return { id: best.id, type: item.type };
        }
        return null;
    } catch (e) {
        console.error('TMDB fetch error:', e);
        return null;
    }
}

async function fetchSeasonData(item) {
    const info = await fetchTmdbId(item);
    if (!info || info.type === 'movie') return;

    // Bewaar bestaande seizoen-/afleveringsstatussen
    const existingSeasons = new Map();
    if (item.seasons) {
        item.seasons.forEach(s => {
            const epMap = new Map();
            s.episodes.forEach(ep => epMap.set(ep.number, ep.status));
            existingSeasons.set(s.number, epMap);
        });
    }

    // Geavanceerde statusbeheer: Maak een map van alle huidige afleveringen (op titel)
    const statusByTitle = new Map();
    if (item.seasons) {
        item.seasons.forEach(s => {
            s.episodes.forEach(ep => {
                const cleanTitle = ep.name.toLowerCase().trim();
                statusByTitle.set(cleanTitle, ep.status);
            });
        });
    }

    try {
        const showRes = await fetch(`https://api.themoviedb.org/3/tv/${info.id}?api_key=${TMDB_API_KEY}&language=en-US`);
        const showData = await showRes.json();
        
        item.seasons = [];
        item.release_date = showData.first_air_date;

        for (const s of showData.seasons) {
            if (s.season_number === 0) continue;

            const seasonRes = await fetch(`https://api.themoviedb.org/3/tv/${info.id}/season/${s.season_number}?api_key=${TMDB_API_KEY}&language=en-US`);
            const seasonData = await seasonRes.json();

            const episodes = (seasonData.episodes || []).map(ep => {
                const cleanTitle = (ep.name || "").toLowerCase().trim();
                const matchedStatus = statusByTitle.get(cleanTitle);
                
                return {
                    number: ep.episode_number,
                    name: ep.name || `Episode ${ep.episode_number}`,
                    status: matchedStatus !== undefined ? matchedStatus : -1
                };
            });

            item.seasons.push({
                number: s.season_number,
                name: s.name || `Season ${s.season_number}`,
                episodes: episodes
            });
        }
        delete item._legacyStatus;
        save();
    } catch (e) {
        console.error('Season fetch error:', e);
    }
}

// --- Status helpers ---

function getAnimeStatus(item) {
    return window.StatusCalculator.getAnimeStatus(item);
}

function getSeasonStatus(season) {
    return window.StatusCalculator.getSeasonStatus(season);
}

function setSeasonStatus(item, season, status) {
    window.AnimeActions.setSeasonStatusLocally(item, season, status);
}

function setAnimeAllStatus(item, status) {
    window.AnimeActions.setAnimeStatusLocally(item, status);
}

function setEpisodeStatus(item, season, episode, status) {
    window.AnimeActions.setEpisodeStatusLocally(item, season, episode, status);
}

// --- VidSrc ---

function getVidsrcUrl(item, seasonNum, episodeNum) {
    if (!item.tmdb_id) return null;
    if (item.type === 'movie') {
        return `https://vidsrc.to/embed/movie/${item.tmdb_id}`;
    }
    return `https://vidsrc.to/embed/tv/${item.tmdb_id}/${seasonNum || 1}/${episodeNum || 1}`;
}

// --- Render ---

function getFilteredSorted() {
    const franchises = new Map();
    
    state.animeList.forEach(item => {
        if (!item || !item.title) return;
        const fName = item.franchise || item.title;
        if (!franchises.has(fName)) {
            franchises.set(fName, {
                title: fName,
                items: [],
                _computedStatus: -1,
                rating: -1,
                poster_path: null,
                tmdb_id: null,
                _isGroup: true
            });
        }
        const group = franchises.get(fName);
        group.items.push(item);
    });

    let list = Array.from(franchises.values()).map(group => {
        const itemWithPoster = group.items.find(i => i.poster_path) || group.items[0];
        group.poster_path = itemWithPoster?.poster_path;
        group.tmdb_id = itemWithPoster?.tmdb_id; // Voor vidsrc backup

        // Bereken gezamenlijke status: 2 (Nieuw) > 0 (Bezig) > -1 (Te Bekijken) > 1 (Bekeken)
        const statuses = group.items.map(item => window.StatusCalculator.getAnimeStatus(item));
        if (statuses.includes(2)) group._computedStatus = 2;
        else if (statuses.includes(0)) group._computedStatus = 0;
        else if (statuses.includes(-1)) group._computedStatus = -1;
        else group._computedStatus = 1;

        group.rating = Math.max(...group.items.map(i => i.rating || -1));
        return group;
    });

    // Filter op actieve statussen
    list = list.filter(a => activeFilters.has(a._computedStatus));

    if (currentSearch) {
        const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
        const s = normalize(currentSearch);
        list = list.filter(a => normalize(a.title).includes(s));
    }

    switch (currentSort) {
        case 'title-asc':  list.sort((a, b) => a.title.localeCompare(b.title)); break;
        case 'title-desc': list.sort((a, b) => b.title.localeCompare(a.title)); break;
        case 'rating-desc': list.sort((a, b) => (b.rating > -1 ? b.rating : -2) - (a.rating > -1 ? a.rating : -2)); break;
        case 'rating-asc':  list.sort((a, b) => (a.rating > -1 ? a.rating : -2) - (b.rating > -1 ? b.rating : -2)); break;
        case 'status': list.sort((a, b) => a._computedStatus - b._computedStatus); break;
    }
    return list;
}

function render() {
    const container = document.getElementById('anime-container');
    container.className = `${currentView}-view size-${currentSize}`;
    container.innerHTML = '';

    const items = getFilteredSorted();

    const statusGroups = {
        '2': { label: 'Nieuwe Seizoenen', icon: 'fas fa-sparkles', items: [] },
        '0': { label: 'Bezig', icon: 'fas fa-play', items: [] },
        '-1': { label: 'Te Bekijken', icon: 'fas fa-clock', items: [] },
        '1': { label: 'Bekeken', icon: 'fas fa-check', items: [] }
    };

    items.forEach(wrapper => {
        const status = String(wrapper._computedStatus);
        if (statusGroups[status]) statusGroups[status].items.push(wrapper);
    });

    const order = ['2', '0', '-1', '1'];
    order.forEach(statusKey => {
        const group = statusGroups[statusKey];
        if (group.items.length === 0) return;

        const column = document.createElement('div');
        column.className = `status-column status-col-${statusKey}`;

        const header = document.createElement('div');
        header.className = 'status-group-header';
        header.innerHTML = `
            <i class="${group.icon}"></i>
            <span>${group.label}</span>
            <span class="group-count">${group.items.length}</span>
        `;
        column.appendChild(header);

        group.items.forEach(fr => {
            column.appendChild(buildCard(fr, fr._computedStatus));
        });

        container.appendChild(column);
    });

    document.getElementById('item-count').textContent = `${items.length} titels getoond`;

    // Active filters sync
    document.querySelectorAll('.filter-btn').forEach(btn => {
        const f = btn.dataset.filter;
        if (f === 'all') {
            btn.classList.toggle('active', activeFilters.size === 4);
        } else {
            btn.classList.toggle('active', activeFilters.has(parseInt(f)));
        }
    });

    // Sync search input with state (in case it got stuck)
    const sInput = document.getElementById('search-input');
    if (sInput.value !== currentSearch) sInput.value = currentSearch;
}

function statusIcon(status) {
    if (status === null) return 'fas fa-clock';
    const icons = { 
        '-1': 'fas fa-clock', 
        '0': 'fas fa-play', 
        '1': 'fas fa-check', 
        '2': 'fas fa-sparkles' 
    };
    return icons[String(status)] || icons['-1'];
}
function statusLabel(status) {
    if (status === null) return 'Gepland';
    return status === -1 ? 'Te Bekijken' : status === 0 ? 'Bezig' : status === 2 ? 'Nieuw Seizoen' : 'Bekeken';
}


function getRatingClass(rating) {
    if (rating === undefined || rating === null || rating < 0) return 'unrated';
    if (rating >= 9) return 'r-9';
    if (rating >= 8) return 'r-8';
    if (rating >= 7) return 'r-7';
    if (rating >= 6) return 'r-6';
    if (rating >= 5) return 'r-5';
    if (rating >= 4) return 'r-4';
    return 'r-0';
}



function buildStatusDropdown(currentStatus, onChange) {
    const div = document.createElement('div');
    div.className = 'status-dropdown';
    div.innerHTML = `
        <button class="status-current" title="${statusLabel(currentStatus)}">
            <span style="display:flex; align-items:center; gap:8px;">
                <i class="${statusIcon(currentStatus)}"></i> <span>${statusLabel(currentStatus)}</span>
            </span>
            <i class="fas fa-chevron-down" style="font-size: 10px; opacity: 0.6;"></i>
        </button>
        <div class="status-menu">
            <div class="status-option" data-val="-1"><i class="fas fa-clock" style="opacity:0.7;"></i> Te Bekijken</div>
            <div class="status-option" data-val="0"><i class="fas fa-play" style="opacity:0.7;"></i> Bezig</div>
            <div class="status-option" data-val="1"><i class="fas fa-check" style="opacity:0.7;"></i> Bekeken</div>
            <div class="status-option" data-val="2" style="display:none;"><i class="fas fa-sparkles" style="opacity:0.7;"></i> Nieuw Seizoen</div>
        </div>
    `;
    div.querySelector('.status-current').addEventListener('click', e => {
        e.stopPropagation();
        document.querySelectorAll('.status-dropdown.open').forEach(d => { if (d !== div) d.classList.remove('open'); });
        div.classList.toggle('open');
    });
    div.querySelectorAll('.status-option').forEach(opt => {
        opt.addEventListener('click', e => {
            e.stopPropagation();
            div.classList.remove('open');
            onChange(parseInt(opt.dataset.val));
        });
    });
    return div;
}

function buildCard(group, computedStatus) {
    const card = document.createElement('div');
    card.className = 'anime-card';
    card.dataset.status = computedStatus;
    if (computedStatus === 1) card.classList.add('status-watched');
    if (computedStatus === 2) card.classList.add('status-new');

    const isGroup = group.items.length > 1 || (group.items[0].type === 'tv' && group.items[0].seasons?.length > 1);
    const isExpanded = expandedItems.has(group.title);
    const isRated = group.rating !== undefined && group.rating > -1;
    const ratingDisplay = isRated ? group.rating.toFixed(1) : '—';

    // Glow effects
    if (isRated) {
        if (group.rating >= 9) card.classList.add('glow-gold');
        else if (group.rating < 2) card.classList.add('glow-red');
    }

    // Status Indicator (alleen in list view)
    if (currentView === 'list') {
        const indicator = document.createElement('div');
        const sClass = computedStatus === 1 ? 'status-done' : 
                      computedStatus === 0 ? 'status-watching' : 
                      computedStatus === 2 ? 'status-new' : 'status-none';
        const sIcon = computedStatus === 1 ? '<i class="fas fa-check"></i>' : 
                     computedStatus === 0 ? '<i class="fas fa-play"></i>' : 
                     computedStatus === 2 ? '<i class="fas fa-sparkles"></i>' : '<i class="fas fa-clock"></i>';
        
        indicator.className = `status-indicator ${sClass}`;
        indicator.innerHTML = sIcon;
        card.prepend(indicator);
    }

    // Poster Section
    const posterContainer = document.createElement('div');
    posterContainer.className = 'card-poster';
    if (group.poster_path) {
        posterContainer.innerHTML = `<img src="https://image.tmdb.org/t/p/w500${group.poster_path}" alt="${group.title}" loading="lazy">`;
    } else {
        posterContainer.innerHTML = `<div class="poster-placeholder"><i class="fas fa-image"></i></div>`;
    }
    card.appendChild(posterContainer);

    // Info Container (Right Side)
    const info = document.createElement('div');
    info.className = 'card-info';

    // Header
    const header = document.createElement('div');
    header.className = 'card-header';
    header.innerHTML = `
        <div class="card-title">
            <span>${group.title}</span>
            ${group.items.length > 1 ? `<span class="group-count-badge">${group.items.length}</span>` : ''}
            ${isGroup ? `<i class="fas fa-chevron-${isExpanded ? 'up' : 'down'} expand-icon"></i>` : ''}
        </div>
    `;
    info.appendChild(header);

    // Actions row
    const actions = document.createElement('div');
    actions.className = 'card-actions';

    // Status dropdown (top-level)
    const statusDd = buildStatusDropdown(computedStatus, (newStatus) => {
        group.items.forEach(item => {
            if (newStatus === 1 && window.StatusCalculator.getAnimeStatus(item) !== 1) {
                // We show rating modal for each unrated item or just first?
                // User might want to rate the whole franchise.
            }
            setAnimeAllStatus(item, newStatus);
        });
        save(); render();
    });
    actions.appendChild(statusDd);

    // Play knop
    const playBtn = document.createElement('button');
    playBtn.className = 'action-btn btn-play';
    playBtn.innerHTML = '<i class="fas fa-play"></i>';
    playBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        // Zoek eerste onbekeken item in de groep
        for (const item of group.items) {
            if (window.StatusCalculator.getAnimeStatus(item) !== 1) {
                let s = 1, eNum = 1;
                if (item.seasons) {
                    for (const season of item.seasons) {
                        const unwatched = season.episodes.find(ep => ep.status !== 1);
                        if (unwatched) { s = season.number; eNum = unwatched.number; break; }
                    }
                }
                const url = getVidsrcUrl(item, s, eNum);
                if (url) { window.open(url, '_blank'); return; }
            }
        }
        // Als alles bekeken is, speel gewoon het eerste
        const first = group.items[0];
        const url = getVidsrcUrl(first, 1, 1);
        if (url) window.open(url, '_blank');
    });
    actions.appendChild(playBtn);

    // Rating badge
    const ratingBadge = document.createElement('span');
    const rClass = getRatingClass(group.rating);
    ratingBadge.className = `rating-badge ${rClass}`;
    ratingBadge.style.cursor = 'pointer';
    ratingBadge.title = 'Klik om te beoordelen';
    ratingBadge.innerHTML = `<i class="fas fa-star" style="font-size:0.7em;"></i> ${ratingDisplay}`;
    ratingBadge.addEventListener('click', (e) => {
        e.stopPropagation();
        showRatingModal(group.items[0], false); // Rate first item for now
    });
    actions.appendChild(ratingBadge);

    info.appendChild(actions);
    card.appendChild(info);

    // Inline expanded content (alleen in list view)
    if (currentView === 'list' && isExpanded) {
        card.appendChild(buildDetailGroup(group));
    }

    // Klik op hele kaart opent detail of inline
    card.style.cursor = 'pointer';
    card.addEventListener('click', async (e) => {
        // Alleen doorklikken als het geen interactief element is
        if (e.target.closest('button, .status-dropdown, input, select, .action-btn, .rating-badge')) return;

        if (currentView === 'grid') {
            showDetailModal(group);
        } else {
            if (expandedItems.has(group.title)) expandedItems.delete(group.title);
            else expandedItems.add(group.title);
            render();
        }
    });

    return card;
}

function buildDetailGroup(group) {
    const detail = document.createElement('div');
    detail.className = 'card-detail-group card-detail';
    
    // Sorteer items in de groep op release_date
    const sortedItems = [...group.items].sort((a, b) => {
        const da = a.release_date || '0000-00-00';
        const db = b.release_date || '0000-00-00';
        return da.localeCompare(db);
    });

    sortedItems.forEach(item => {
        const itemBlock = document.createElement('div');
        itemBlock.className = 'item-block';
        
        const itHeader = document.createElement('div');
        itHeader.className = 'item-header';
        itHeader.innerHTML = `
            <div class="item-title-row">
                <span class="item-type-badge">${item.type === 'movie' ? 'Movie' : 'Series'}</span>
                <span class="item-title-text">${item.title}</span>
                <span class="item-year-text">${item.release_date ? `(${item.release_date.substring(0, 4)})` : ''}</span>
            </div>
        `;
        itemBlock.appendChild(itHeader);

        if (item.type === 'movie') {
            const movieRow = document.createElement('div');
            movieRow.className = 'movie-row';
            
            const movieStatusDd = buildStatusDropdown(item.status || -1, (newStatus) => {
                item.status = newStatus;
                save(); render();
            });
            movieRow.appendChild(movieStatusDd);
            
            const moviePlay = document.createElement('button');
            moviePlay.className = 'action-btn btn-play btn-tiny';
            moviePlay.innerHTML = '<i class="fas fa-play"></i>';
            moviePlay.addEventListener('click', (e) => {
                e.stopPropagation();
                const url = getVidsrcUrl(item, 1, 1);
                if (url) window.open(url, '_blank');
            });
            movieRow.appendChild(moviePlay);
            
            itemBlock.appendChild(movieRow);
        } else {
            // TV Seasons
            if (!item.seasons || item.seasons.length === 0) {
                const fetchBtn = document.createElement('button');
                fetchBtn.className = 'action-btn btn-small';
                fetchBtn.textContent = 'Haal seizoenen op';
                fetchBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    await fetchSeasonData(item);
                    render();
                    if (currentView === 'grid') showDetailModal(group);
                });
                itemBlock.appendChild(fetchBtn);
            } else {
                item.seasons.forEach(season => {
                    itemBlock.appendChild(buildSeasonRow(item, season));
                });
            }
        }
        detail.appendChild(itemBlock);
    });

    return detail;
}

function buildSeasonRow(item, season) {
    const seasonKey = `${item.title}-S${season.number}`;
    const isOpen = expandedSeasons.has(seasonKey);

    const sBlock = document.createElement('div');
    sBlock.className = 'season-block';

    const sHeader = document.createElement('div');
    sHeader.className = 'season-header';
    
    const sStatusDd = buildStatusDropdown(getSeasonStatus(season), (newStatus) => {
        setSeasonStatus(item, season, newStatus);
        save(); render();
    });

    const sTitle = document.createElement('span');
    sTitle.className = 'season-title';
    sTitle.textContent = `${season.name || `Season ${season.number}`} (${season.episodes.length} afl.)`;

    sHeader.appendChild(sStatusDd);
    sHeader.appendChild(sTitle);
    
    // Chevron en Play
    const sChevron = document.createElement('i');
    sChevron.className = `fas fa-chevron-${isOpen ? 'up' : 'down'} expand-icon`;
    sHeader.appendChild(sChevron);

    sHeader.addEventListener('click', (e) => {
        e.stopPropagation();
        if (e.target.closest('.status-dropdown, .action-btn')) return;
        if (expandedSeasons.has(seasonKey)) expandedSeasons.delete(seasonKey);
        else expandedSeasons.add(seasonKey);
        render();
        if (currentlyShownItem) showDetailModal(currentlyShownItem);
    });

    sBlock.appendChild(sHeader);

    if (isOpen) {
        const epList = document.createElement('div');
        epList.className = 'episode-list';
        season.episodes.forEach(ep => {
            const epRow = document.createElement('div');
            epRow.className = 'episode-row';
            
            const epStatusDd = buildStatusDropdown(ep.status, (newStatus) => {
                setEpisodeStatus(item, season, ep, newStatus);
                save(); render();
            });
            
            const epTitle = document.createElement('span');
            epTitle.className = 'ep-title';
            epTitle.textContent = `E${ep.number} — ${ep.name}`;
            
            const epPlay = document.createElement('button');
            epPlay.className = 'action-btn btn-play btn-tiny';
            epPlay.innerHTML = '<i class="fas fa-play"></i>';
            epPlay.addEventListener('click', (e) => {
                e.stopPropagation();
                const url = getVidsrcUrl(item, season.number, ep.number);
                if (url) window.open(url, '_blank');
            });

            epRow.appendChild(epStatusDd);
            epRow.appendChild(epTitle);
            epRow.appendChild(epPlay);
            epList.appendChild(epRow);
        });
        sBlock.appendChild(epList);
    }
    return sBlock;
}

function showDetailModal(group) {
    currentlyShownItem = group;
    const titleEl = document.getElementById('detail-title');
    titleEl.innerHTML = `<span>${group.title}</span>`;
    
    const topDd = buildStatusDropdown(group._computedStatus, (newStatus) => {
        group.items.forEach(item => setAnimeAllStatus(item, newStatus));
        save(); render();
        showDetailModal(group);
    });
    topDd.style.marginLeft = '15px';
    titleEl.appendChild(topDd);

    const content = document.getElementById('detail-content');
    content.innerHTML = '';
    content.appendChild(buildDetailGroup(group));

    document.getElementById('detail-overlay').classList.remove('hidden');
}

document.getElementById('close-detail').addEventListener('click', () => {
    currentlyShownItem = null;
    document.getElementById('detail-overlay').classList.add('hidden');
});

document.getElementById('detail-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
        currentlyShownItem = null;
        document.getElementById('detail-overlay').classList.add('hidden');
    }
});

function renderBatchBar(x, y) {
    let bar = document.getElementById('batch-bar');
    if (selectedEpisodes.size === 0) {
        if (bar) bar.remove();
        return;
    }

    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'batch-bar';
        bar.className = 'batch-bar';
        document.body.appendChild(bar);
    }

    bar.style.left = `${Math.min(window.innerWidth - 220, x + 15)}px`;
    bar.style.top = `${Math.min(window.innerHeight - 150, y + 15)}px`;

    bar.innerHTML = `
        <div class="batch-header">
            <span><b>${selectedEpisodes.size}</b> geselecteerd</span>
            <button class="batch-close" onclick="clearSelection()">&times;</button>
        </div>
        <div class="batch-options">
            <button onclick="applyBatchStatus(1)"><i class="fas fa-check"></i> Bekeken</button>
            <button onclick="applyBatchStatus(0)"><i class="fas fa-play"></i> Bezig</button>
            <button onclick="applyBatchStatus(-1)"><i class="fas fa-clock"></i> Te Bekijken</button>
        </div>
    `;
}

window.clearSelection = function() {
    selectedEpisodes.clear();
    renderBatchBar();
    
    // Manually clear classes to avoid a full re-render flickering
    document.querySelectorAll('.episode-row.selected').forEach(r => r.classList.remove('selected'));
    
    // Refresh main view for background items
    render();
};

window.applyBatchStatus = function(status) {
    if (selectedEpisodes.size === 0) return;
    
    console.log(`Applying status ${status} to ${selectedEpisodes.size} episodes`);
    
    selectedEpisodes.forEach(({ item, season, episode }) => {
        // Direct mutation and ensuring it sticks
        episode.status = parseInt(status);
    });
    
    save();
    
    // Refresh modal if open
    if (currentlyShownItem) {
        showDetailModal(currentlyShownItem);
    }
    
    clearSelection();
};

// --- Modal ---

let currentItem = null;
let ratingChangeStatus = false;

function showRatingModal(item, changeStatus = true) {
    currentItem = item;
    ratingChangeStatus = changeStatus;
    document.getElementById('modal-title').textContent = item.title;
    document.getElementById('rating-number').value = (item.rating !== undefined && item.rating > -1) ? item.rating.toFixed(1) : '7.0';
    document.getElementById('modal-overlay').classList.remove('hidden');
}

document.getElementById('cancel-rating').addEventListener('click', () => {
    document.getElementById('modal-overlay').classList.add('hidden');
});

document.getElementById('save-rating').addEventListener('click', () => {
    const raw = parseFloat(document.getElementById('rating-number').value);
    const clamped = Math.min(10, Math.max(0, raw));
    currentItem.rating = Math.round(clamped * 10) / 10;
    if (ratingChangeStatus) setAnimeAllStatus(currentItem, 1);
    save(); render();
    document.getElementById('modal-overlay').classList.add('hidden');
});

document.getElementById('clear-rating').addEventListener('click', () => {
    currentItem.rating = -1;
    save(); render();
    document.getElementById('modal-overlay').classList.add('hidden');
});

// --- Toolbar ---

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const f = btn.dataset.filter;
        if (f === 'all') {
            // Reset alles: filters terug naar alles aan én zoekopdracht wissen
            activeFilters = new Set([-1, 0, 1, 2]);
            currentSearch = ''; 
        } else {
            const status = parseInt(f);
            if (activeFilters.has(status)) activeFilters.delete(status);
            else activeFilters.add(status);
        }
        localStorage.setItem('rascal_filters', JSON.stringify([...activeFilters]));
        render();
    });
});

document.querySelectorAll('.size-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentSize = btn.dataset.size;
        localStorage.setItem('rascal_size', currentSize);
        render();
    });
});

document.getElementById('sort-select').addEventListener('change', e => {
    currentSort = e.target.value;
    render();
});

document.getElementById('grid-btn').addEventListener('click', () => {
    currentView = 'grid';
    localStorage.setItem('rascal_view', currentView);
    document.getElementById('grid-btn').classList.add('active');
    document.getElementById('list-btn').classList.remove('active');
    render();
});

document.getElementById('list-btn').addEventListener('click', () => {
    currentView = 'list';
    localStorage.setItem('rascal_view', currentView);
    document.getElementById('list-btn').classList.add('active');
    document.getElementById('grid-btn').classList.remove('active');
    render();
});

// --- Add ---

document.getElementById('add-btn').addEventListener('click', addNew);
document.getElementById('new-anime-input').addEventListener('keypress', e => { if (e.key === 'Enter') addNew(); });

// --- Search ---

document.getElementById('search-input').addEventListener('input', e => {
    currentSearch = e.target.value.trim();
    render();
});

function addNew() {
    const input = document.getElementById('new-anime-input');
    const val = input.value.trim();
    if (val) {
        state.animeList.unshift({ title: val, status: -1, rating: -1 });
        input.value = '';
        save(); render();
    }
}

// --- Theme ---

function initTheme() {
    const manual = localStorage.getItem('rascal_theme');
    let theme;
    if (manual) theme = manual;
    else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) theme = 'dark';
    else theme = 'light';
    applyTheme(theme);
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        if (!localStorage.getItem('rascal_theme')) applyTheme(e.matches ? 'dark' : 'light');
    });
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const icon = document.getElementById('theme-toggle').querySelector('i');
    if (theme === 'light') icon.className = 'fas fa-moon';
    else if (theme === 'dark') icon.className = 'fas fa-star';
    else icon.className = 'fas fa-sun';
}

document.getElementById('theme-toggle').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'light' ? 'dark' : current === 'dark' ? 'midnight' : 'light';
    localStorage.setItem('rascal_theme', next);
    applyTheme(next);
});

document.getElementById('download-btn').addEventListener('click', () => {
    exportData();
});

initTheme();
init();

document.addEventListener('click', () => {
    document.querySelectorAll('.status-dropdown.open').forEach(d => d.classList.remove('open'));
});

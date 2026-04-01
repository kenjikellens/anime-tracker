const TMDB_API_KEY = 'a341dc9a3c2dffa62668b614a98c1188';

let state = { animeList: [] };
let activeFilters = new Set(JSON.parse(localStorage.getItem('rascal_filters')) || [-1, 0, 1, 2]); // Alle statussen standaard aan
let currentSearch = '';
let currentSort = 'default';
let currentView = localStorage.getItem('rascal_view') || 'grid';
let currentSize = localStorage.getItem('rascal_size') || 'm'; // s, m, l
let expandedItems = new Set(); // set van anime titels die zijn uitgeklapt
let expandedSeasons = new Set(); // welke seizoenen zijn uitgeklapt (key: "title-S1")

// --- Init ---

async function init() {
    try {
        const res = await fetch('/data.json');
        state.animeList = await res.json();
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
        await fetch('/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(state.animeList, null, 2)
        });
    } catch (e) {
        console.error('Opslaan mislukt:', e);
    }
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

    // Legacy migratie: als het item nog een _legacyStatus heeft, gebruik die voor de eerste keer
    const legacyDefault = item._legacyStatus !== undefined ? item._legacyStatus : -1;
    const isFirstFetch = existingSeasons.size === 0;

    try {
        // Haal show details op voor seizoenaantallen
        const showRes = await fetch(`https://api.themoviedb.org/3/tv/${info.id}?api_key=${TMDB_API_KEY}&language=en-US`);
        const showData = await showRes.json();

        item.seasons = [];

        for (const s of showData.seasons) {
            if (s.season_number === 0) continue; // skip specials

            // Haal afleveringen per seizoen op
            const seasonRes = await fetch(`https://api.themoviedb.org/3/tv/${info.id}/season/${s.season_number}?api_key=${TMDB_API_KEY}&language=en-US`);
            const seasonData = await seasonRes.json();

            const existingEps = existingSeasons.get(s.season_number);

            const episodes = (seasonData.episodes || []).map(ep => ({
                number: ep.episode_number,
                name: ep.name || `Aflevering ${ep.episode_number}`,
                // Bestaande status behouden, anders:
                // - Eerste keer ophalen: legacy status gebruiken
                // - Niet eerste keer (sync): -1 (nieuw seizoen/aflevering!)
                status: existingEps
                    ? (existingEps.get(ep.episode_number) ?? -1)
                    : (isFirstFetch ? legacyDefault : -1)
            }));

            item.seasons.push({
                number: s.season_number,
                name: s.name || `Seizoen ${s.season_number}`,
                episodes: episodes
            });
        }

        // Verwijder oude/redundante velden
        delete item.season;
        delete item.episode;
        delete item.status;
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
    // Dedupliceren op basis van titel (om '6x Golden Time' bugs te voorkomen)
    const seen = new Set();
    let list = state.animeList.filter(item => {
        if (!item || !item.title || seen.has(item.title)) return false;
        seen.add(item.title);
        return true;
    }).map(item => {
        const computed = window.StatusCalculator.getAnimeStatus(item);
        return { ...item, _computedStatus: computed, _ref: item };
    });

    // Filter op actieve statussen (multi-select)
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

        group.items.forEach(wrapper => {
            column.appendChild(buildCard(wrapper._ref, wrapper._computedStatus));
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
    if (status === null) return 'resources/img/clock.svg';
    const icons = { '-1': 'resources/img/clock.svg', '0': 'resources/img/playing.svg', '1': 'resources/img/check.svg', '2': 'resources/img/clock.svg' };
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
            <img src="${statusIcon(currentStatus)}"> <span>${statusLabel(currentStatus)}</span>
        </button>
        <div class="status-menu">
            <div class="status-option" data-val="-1"><img src="resources/img/clock.svg"> Te Bekijken</div>
            <div class="status-option" data-val="0"><img src="resources/img/playing.svg"> Bezig</div>
            <div class="status-option" data-val="1"><img src="resources/img/check.svg"> Bekeken</div>
            <div class="status-option" data-val="2" style="display:none;"><img src="resources/img/clock.svg"> Nieuw Seizoen</div>
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

function buildCard(item, computedStatus) {
    const card = document.createElement('div');
    card.className = 'anime-card';
    card.dataset.status = computedStatus;
    if (computedStatus === 1) card.classList.add('status-watched');
    if (computedStatus === 2) card.classList.add('status-new');

    const isMovie = item.type === 'movie';
    const isExpanded = expandedItems.has(item.title);
    const isRated = item.rating !== undefined && item.rating > -1;
    const ratingDisplay = isRated ? item.rating.toFixed(1) : '—';

    // Glow effects
    if (isRated) {
        if (item.rating >= 9) card.classList.add('glow-gold');
        else if (item.rating < 2) card.classList.add('glow-red');
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
    if (item.poster_path) {
        posterContainer.innerHTML = `<img src="https://image.tmdb.org/t/p/w500${item.poster_path}" alt="${item.title}" loading="lazy">`;
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
            <span>${item.title}</span>
            ${!isMovie ? `<i class="fas fa-chevron-${isExpanded ? 'up' : 'down'} expand-icon"></i>` : ''}
        </div>
    `;
    info.appendChild(header);

    // Actions row
    const actions = document.createElement('div');
    actions.className = 'card-actions';

    // Status dropdown (top-level)
    const statusDd = buildStatusDropdown(computedStatus, (newStatus) => {
        if (newStatus === 1 && computedStatus !== 1) {
            showRatingModal(item, true);
        } else {
            setAnimeAllStatus(item, newStatus);
            save(); render();
        }
    });
    actions.appendChild(statusDd);

    // Play knop
    const playBtn = document.createElement('button');
    playBtn.className = 'action-btn btn-play';
    playBtn.innerHTML = '<i class="fas fa-play"></i>';
    playBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        playBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        const infoData = await fetchTmdbId(item);
        playBtn.innerHTML = '<i class="fas fa-play"></i>';
        if (!infoData) { alert('Niet gevonden op TMDB: ' + item.title); return; }
        // Zoek eerste onbekeken aflevering
        let s = 1, eNum = 1;
        if (item.seasons) {
            for (const season of item.seasons) {
                const unwatched = season.episodes.find(ep => ep.status !== 1);
                if (unwatched) { s = season.number; eNum = unwatched.number; break; }
            }
        }
        const url = getVidsrcUrl(item, s, eNum);
        if (url) window.open(url, '_blank');
    });
    actions.appendChild(playBtn);

    // Rating badge
    const ratingBadge = document.createElement('span');
    const rClass = getRatingClass(item.rating);
    ratingBadge.className = `rating-badge ${rClass}`;
    ratingBadge.style.cursor = 'pointer';
    ratingBadge.title = 'Klik om te beoordelen';
    ratingBadge.innerHTML = `<i class="fas fa-star" style="font-size:0.7em;"></i> ${ratingDisplay}`;
    ratingBadge.addEventListener('click', (e) => {
        e.stopPropagation();
        showRatingModal(item, false);
    });
    actions.appendChild(ratingBadge);

    info.appendChild(actions);
    card.appendChild(info);

    // Klik op hele kaart opent detail of inline (werkt nu ook voor films)
    card.style.cursor = 'pointer';
    card.addEventListener('click', async (e) => {
        // Niet openen als er op een interactief element geklikt is
        if (e.target.closest('.status-dropdown, .action-btn, .rating-badge, input, select, .card-detail')) return;

        if (!isMovie && (!item.seasons || item.seasons.length === 0)) {
            const icon = card.querySelector('.expand-icon');
            if (icon) icon.className = 'fas fa-spinner fa-spin expand-icon';
            await fetchSeasonData(item);
        }

        if (currentView === 'grid') {
            showDetailModal(item);
        } else {
            if (expandedItems.has(item.title)) expandedItems.delete(item.title);
            else expandedItems.add(item.title);
            render();
        }
    });

    // Inline expanded content (alleen in list view)
    if (currentView === 'list' && isExpanded) {
        card.appendChild(buildDetail(item));
    }

    return card;
}

function buildDetail(item) {
    const detail = document.createElement('div');
    detail.className = 'card-detail';
    detail.addEventListener('click', e => e.stopPropagation());

    if (item.seasons && item.seasons.length > 0) {
        item.seasons.forEach(season => {
            const seasonKey = `${item.title}-S${season.number}`;
            const isOpen = expandedSeasons.has(seasonKey);

            const sBlock = document.createElement('div');
            sBlock.className = 'season-block';

            const sHeader = document.createElement('div');
            sHeader.className = 'season-header';
            sHeader.style.cursor = 'pointer';

            const sStatusDd = buildStatusDropdown(getSeasonStatus(season), (newStatus) => {
                setSeasonStatus(item, season, newStatus);
                save();
                if (currentView === 'grid') showDetailModal(item);
                else render();
            });

            const sChevron = document.createElement('i');
            sChevron.className = `fas fa-chevron-${isOpen ? 'up' : 'down'} expand-icon`;

            const sTitle = document.createElement('span');
            sTitle.className = 'season-title';
            sTitle.textContent = `${season.name || `Seizoen ${season.number}`} (${season.episodes.length} afl.)`;

            const sPlay = document.createElement('button');
            sPlay.className = 'action-btn btn-play btn-small';
            sPlay.innerHTML = '<i class="fas fa-play"></i>';
            sPlay.title = 'Speel eerste onbekeken aflevering';
            sPlay.addEventListener('click', (e) => {
                e.stopPropagation();
                const unwatched = season.episodes.find(ep => ep.status !== 1);
                const epNum = unwatched ? unwatched.number : 1;
                const url = getVidsrcUrl(item, season.number, epNum);
                if (url) window.open(url, '_blank');
            });

            // Split season button
            const sSplit = document.createElement('button');
            sSplit.className = 'action-btn btn-small';
            sSplit.innerHTML = '<i class="fas fa-scissors"></i>';
            sSplit.title = 'Splits in een nieuw seizoen';
            sSplit.addEventListener('click', (e) => {
                e.stopPropagation();
                if (season.episodes.length < 2) return alert('Niet genoeg afleveringen.');
                const ans = prompt(`Dit seizoen heeft ${season.episodes.length} afleveringen.\n\nTip: Typ 'reset' om vanaf thetvdb/tmdb te herladen (en alle handmatige splits en statussen te verliezen).\n\nOF: typ een **aflevering-nummer** vanaf waar het een nieuw seizoen moet worden (bv. 26).`);
                
                if (ans && ans.toLowerCase().trim() === 'reset') {
                    if (confirm('Zeker dat je alles wilt herladen? Je raakt al je splits en statussen voor deze anime kwijt.')) {
                        delete item.seasons;
                        fetchSeasonData(item).then(() => {
                            if (currentView === 'grid') showDetailModal(item);
                            else render();
                        });
                    }
                    return;
                }

                const splitAt = parseInt(ans);
                if (!splitAt || splitAt <= 1 || splitAt > season.episodes.length) return;
                
                const idx = splitAt - 1;
                const movedEps = season.episodes.splice(idx);
                
                // Hernummer de nieuwe afleveringen (voor correcte vidsrc url)
                movedEps.forEach((ep, i) => {
                    // Simpele regex om "Episode 26" in "Episode 1" te veranderen
                    ep.name = ep.name.replace(new RegExp(`(\\s|^)${splitAt + i}(\\s|$)`), `$1${i + 1}$2`);
                    ep.number = i + 1;
                });
                
                const newSNum = Math.max(...item.seasons.map(s => s.number)) + 1;
                item.seasons.push({
                    number: newSNum,
                    name: `Season ${newSNum}`,
                    episodes: movedEps
                });
                
                item.seasons.sort((a,b) => a.number - b.number);
                save();
                if (currentView === 'grid') showDetailModal(item);
                else render();
            });


            sHeader.addEventListener('click', (e) => {
                if (e.target.closest('.status-dropdown, .action-btn')) return;
                if (expandedSeasons.has(seasonKey)) expandedSeasons.delete(seasonKey);
                else expandedSeasons.add(seasonKey);
                if (currentView === 'grid') showDetailModal(item);
                else render();
            });

            sHeader.appendChild(sStatusDd);
            sHeader.appendChild(sChevron);
            sHeader.appendChild(sTitle);
            sHeader.appendChild(sSplit);
            sHeader.appendChild(sPlay);
            sBlock.appendChild(sHeader);

            if (isOpen) {
                const epList = document.createElement('div');
                epList.className = 'episode-list';

                season.episodes.forEach(ep => {
                    const epRow = document.createElement('div');
                    epRow.className = 'episode-row';
                    epRow.dataset.status = ep.status;

                    const epStatusDd = buildStatusDropdown(ep.status, (newStatus) => {
                        setEpisodeStatus(item, season, ep, newStatus);
                        save();
                        if (currentView === 'grid') showDetailModal(item);
                        else render();
                    });

                    const epTitle = document.createElement('span');
                    epTitle.className = 'ep-title';
                    epTitle.textContent = `E${ep.number} — ${ep.name}`;

                    const epPlay = document.createElement('button');
                    epPlay.className = 'action-btn btn-play btn-tiny';
                    epPlay.innerHTML = '<i class="fas fa-play"></i>';
                    epPlay.addEventListener('click', () => {
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

            detail.appendChild(sBlock);
        });
    }

    // Franchise koppeling in detailpaneel
    const franchiseRow = document.createElement('div');
    franchiseRow.className = 'franchise-edit-row';
    franchiseRow.innerHTML = `
        <i class="fas fa-link" style="color:var(--text-muted);font-size:12px;"></i>
        <input type="text" class="franchise-name-input" value="${item.franchise || ''}" placeholder="Franchise naam (bv. KonoSuba)...">
        <button class="action-btn btn-play btn-small" id="save-franchise-link">Koppel</button>
    `;
    franchiseRow.querySelector('#save-franchise-link').addEventListener('click', () => {
        const val = franchiseRow.querySelector('.franchise-name-input').value.trim();
        if (val) item.franchise = val;
        else delete item.franchise;
        save();
        if (currentView === 'grid') document.getElementById('detail-overlay').classList.add('hidden');
        render();
    });
    detail.appendChild(franchiseRow);

    return detail;
}

// --- Detail Modal (grid view) ---

function showDetailModal(item) {
    const titleEl = document.getElementById('detail-title');
    titleEl.innerHTML = '';
    
    // Titel
    const txtSpan = document.createElement('span');
    txtSpan.textContent = item.title;
    titleEl.appendChild(txtSpan);
    
    // Globale status in detail venster (Oplossing 4)
    const computedStatus = getAnimeStatus(item);
    const topDd = buildStatusDropdown(computedStatus, (newStatus) => {
        setAnimeAllStatus(item, newStatus);
        save();
        showDetailModal(item);
        render(); // update kaarten achtergrond
    });
    topDd.style.marginLeft = '15px';
    topDd.style.display = 'inline-block';
    topDd.querySelector('.status-current').style.background = 'var(--surface-color)'; // lichte contrast aanpassing
    titleEl.appendChild(topDd);

    const content = document.getElementById('detail-content');
    content.innerHTML = '';
    content.appendChild(buildDetail(item));

    document.getElementById('detail-overlay').classList.remove('hidden');
    render(); // update kaarten achtergrond
}

document.getElementById('close-detail').addEventListener('click', () => {
    document.getElementById('detail-overlay').classList.add('hidden');
});

document.getElementById('detail-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
        document.getElementById('detail-overlay').classList.add('hidden');
    }
});

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

initTheme();
init();

document.addEventListener('click', () => {
    document.querySelectorAll('.status-dropdown.open').forEach(d => d.classList.remove('open'));
});

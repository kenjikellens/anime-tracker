// domein/Components.js
window.Components = (function() {

    /**
     * Bouwt een herbruikbaar status-dropdown-element.
     * @param {number} currentStatus - Huidige geselecteerde status
     * @param {function(number): void} onChange - Callback bij statuswijziging
     * @returns {HTMLElement} Het dropdown-div-element
     */
    function buildStatusDropdown(currentStatus, onChange) {
        const div = document.createElement('div');
        div.className = 'status-dropdown';
        div.innerHTML = `
            <button class="status-current" title="${UIHelpers.statusLabel(currentStatus)}">
                <span style="display:flex; align-items:center; gap:8px;">
                    <i class="${UIHelpers.statusIcon(currentStatus)}"></i> <span>${UIHelpers.statusLabel(currentStatus)}</span>
                </span>
                <i class="fas fa-chevron-down" style="font-size: 10px; opacity: 0.6;"></i>
            </button>
        `;

        const btn = div.querySelector('.status-current');
        btn.addEventListener('click', e => {
            e.stopImmediatePropagation();
            e.preventDefault();
            const globalMenu = document.getElementById('global-status-menu');
            
            // Build options dynamically
            globalMenu.innerHTML = `
                <div class="status-option" data-val="-1"><i class="fas fa-clock" style="opacity:0.7;"></i> Te Bekijken</div>
                <div class="status-option" data-val="0"><i class="fas fa-play" style="opacity:0.7;"></i> Bezig</div>
                <div class="status-option" data-val="1"><i class="fas fa-check" style="opacity:0.7;"></i> Bekeken</div>
            `;

            // Display first, then calculate (to get dimensions if needed, though width is fixed)
            globalMenu.style.display = 'block';
            
            // Position calculation
            const rect = btn.getBoundingClientRect();
            const menuWidth = 160;
            
            // Try to align left with button, but keep on screen
            let left = rect.left;
            if (left + menuWidth > window.innerWidth) {
                left = rect.right - menuWidth;
            }
            if (left < 0) left = 10; // Safety margin

            let top = rect.bottom + 4;

            // Check if it's off screen bottom
            const menuHeight = 130;
            if (top + menuHeight > window.innerHeight) {
                top = rect.top - menuHeight - 4; // Open upwards
            }

            globalMenu.style.left = `${left}px`;
            globalMenu.style.top = `${top}px`;

            // Add click listeners to options
            globalMenu.querySelectorAll('.status-option').forEach(opt => {
                opt.onclick = (event) => {
                    event.stopPropagation();
                    onChange(parseInt(opt.dataset.val));
                    globalMenu.style.display = 'none';
                };
            });
        });
        return div;
    }

    /**
     * Bouwt een play-dropdown-element die de verschillende videobronnen (vsembed, etc) opent.
     * @param {Object} item - Anime-item
     * @param {number} s - Seizoennummer
     * @param {number} eNum - Afleveringsnummer
     * @returns {HTMLElement}
     */
    function buildPlayDropdown(item, s, eNum) {
        const btn = document.createElement('button');
        btn.className = 'action-btn btn-play';
        btn.innerHTML = '<i class="fas fa-play"></i>';
        btn.title = 'Kies een bron om te kijken';

        btn.addEventListener('click', e => {
            e.stopImmediatePropagation();
            e.preventDefault();
            const globalMenu = document.getElementById('global-status-menu');
            
            // Haal de sources op uit EmbedSources.js (EMBED_SOURCES is globaal)
            globalMenu.innerHTML = Object.entries(EMBED_SOURCES).map(([key, src]) => `
                <div class="status-option" data-key="${key}">
                    <i class="fas fa-external-link-alt" style="opacity:0.7;"></i> ${src.label}
                </div>
            `).join('');

            // Display en positie
            globalMenu.style.display = 'block';
            const rect = btn.getBoundingClientRect();
            const menuWidth = 160;
            
            let left = rect.left;
            if (left + menuWidth > window.innerWidth) left = rect.right - menuWidth;
            if (left < 0) left = 10;

            let top = rect.bottom + 4;
            const menuHeight = Object.keys(EMBED_SOURCES).length * 40;
            if (top + menuHeight > window.innerHeight) top = rect.top - menuHeight - 4;

            globalMenu.style.left = `${left}px`;
            globalMenu.style.top = `${top}px`;

            // Handlers voor de opties
            globalMenu.querySelectorAll('.status-option').forEach(opt => {
                opt.onclick = (event) => {
                    event.stopPropagation();
                    const key = opt.dataset.key;
                    const src = EMBED_SOURCES[key];
                    const url = item.type === 'movie' ? src.movie(item.tmdb_id) : src.tv(item.tmdb_id, s, eNum);
                    if (url) window.open(url, '_blank');
                    globalMenu.style.display = 'none';
                };
            });
        });
        return btn;
    }

    /**
     * Bouwt een anime-kaart voor een franchise-groep.
     * @param {Object} group - Franchise-groepsobject
     * @param {number} computedStatus - Gecombineerde status
     * @returns {HTMLElement}
     */
    function buildCard(group, computedStatus) {
        const card = document.createElement('div');
        card.className = 'anime-card';
        card.dataset.status = computedStatus;

        const isAnilistLinked = group.items.some(it => it.anilist_id);
        if (isAnilistLinked) {
            const alIndicator = document.createElement('div');
            alIndicator.className = 'anilist-status-tag';
            alIndicator.innerHTML = '<i class="fa-brands fa-anilist"></i>';
            alIndicator.title = 'Gesynchroniseerd met AniList. Klik om handmatig te pushen.';
            alIndicator.addEventListener('click', async (e) => {
                e.stopPropagation();
                alIndicator.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                for (const item of group.items) {
                    if (item.anilist_id) await triggerAutoSync(item);
                }
                setTimeout(() => {
                    alIndicator.innerHTML = '<i class="fa-brands fa-anilist"></i>';
                }, 1000);
            });
            card.appendChild(alIndicator);
        }
        if (computedStatus === 1) card.classList.add('status-watched');

        const isGroup = group.items.length > 1 || (group.items[0].type === 'tv' && group.items[0].seasons?.length > 1);
        const isExpanded = expandedItems.has(group.title);
        const isRated = group.rating !== undefined && group.rating > -1;
        const ratingDisplay = isRated ? group.rating.toFixed(1) : '—';

        if (isRated) {
            if (group.rating >= 9) card.classList.add('glow-gold');
            else if (group.rating < 2) card.classList.add('glow-red');
        }

        if (currentView === 'list') {
            const indicator = document.createElement('div');
            const sClass = computedStatus === 1 ? 'status-done' :
                          computedStatus === 0 ? 'status-watching' : 'status-none';
            const sIcon = computedStatus === 1 ? '<i class="fas fa-check"></i>' :
                         computedStatus === 0 ? '<i class="fas fa-play"></i>' : '<i class="fas fa-clock"></i>';

            indicator.className = `status-indicator ${sClass}`;
            indicator.innerHTML = sIcon;
            card.prepend(indicator);
        }

        const posterContainer = document.createElement('div');
        posterContainer.className = 'card-poster';
        if (group.poster_path) {
            const posterUrl = group.poster_path.startsWith('http') ? group.poster_path : `https://image.tmdb.org/t/p/w500${group.poster_path}`;
            posterContainer.innerHTML = `<img src="${posterUrl}" alt="${group.title}" loading="lazy">`;
        } else {
            posterContainer.innerHTML = `<div class="poster-placeholder"><i class="fas fa-image"></i></div>`;
        }
        card.appendChild(posterContainer);

        const info = document.createElement('div');
        info.className = 'card-info';
        const header = document.createElement('div');
        header.className = 'card-header';
        header.innerHTML = `
            <div class="card-title">
                <span>${group.title}</span>
                ${isGroup ? `<i class="fas fa-chevron-${isExpanded ? 'up' : 'down'} expand-icon"></i>` : ''}
            </div>
        `;
        info.appendChild(header);

        const actions = document.createElement('div');
        actions.className = 'card-actions';

        const statusDd = buildStatusDropdown(computedStatus, (newStatus) => {
            group.items.forEach(item => setAnimeAllStatus(item, newStatus));
            save(); render();
        });
        actions.appendChild(statusDd);

        // Zoek de meest relevante play-info (eerste onbekeken)
        let playItem = group.items[0], sP = 1, eP = 1;
        for (const it of group.items) {
            if (window.StatusCalculator.getAnimeStatus(it) !== 1) {
                playItem = it;
                if (it.seasons) {
                    for (const season of it.seasons) {
                        const unwatched = season.episodes.find(ep => ep.status !== 1);
                        if (unwatched) { sP = season.number; eP = unwatched.number; break; }
                    }
                }
                break;
            }
        }
        const playBtn = buildPlayDropdown(playItem, sP, eP);
        actions.appendChild(playBtn);

        const ratingBadge = document.createElement('span');
        const rClass = UIHelpers.getRatingClass(group.rating);
        ratingBadge.className = `rating-badge ${rClass}`;
        ratingBadge.style.cursor = 'pointer';
        ratingBadge.title = 'Klik om te beoordelen';
        ratingBadge.innerHTML = `<i class="fas fa-star" style="font-size:0.7em;"></i> ${ratingDisplay}`;
        ratingBadge.addEventListener('click', (e) => {
            e.stopPropagation();
            Modals.showRatingModal(group.items[0], false);
        });
        actions.appendChild(ratingBadge);

        info.appendChild(actions);
        card.appendChild(info);

        if (currentView === 'list' && isExpanded) {
            card.appendChild(buildDetailGroup(group));
        }

        card.style.cursor = 'pointer';
        card.addEventListener('click', async (e) => {
            if (e.target.closest('button, .status-dropdown, input, select, .action-btn, .rating-badge')) return;
            if (currentView === 'grid') {
                Modals.showDetailModal(group);
            } else {
                if (expandedItems.has(group.title)) expandedItems.delete(group.title);
                else expandedItems.add(group.title);
                render();
            }
        });
        return card;
    }

    /**
     * Builds the expanded detail block for a franchise in list view.
     * @param {Object} group - The franchise group object.
     * @returns {HTMLElement} The detail container.
     */
    function buildDetailGroup(group) {
        const detail = document.createElement('div');
        detail.className = 'card-detail-group card-detail';
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
            const lowerItem = item.title.toLowerCase();
            const lowerGroup = group.title.toLowerCase();
            const isRedundantTitle = lowerItem === lowerGroup || lowerItem.includes(lowerGroup) || lowerGroup.includes(lowerItem);
            
            if (!isRedundantTitle || group.items.length > 1) {
                itHeader.innerHTML = `
                    <div class="item-title-row">
                        <span class="item-type-badge">${item.type === 'movie' ? 'Movie' : 'Series'}</span>
                        ${isRedundantTitle ? '' : `<span class="item-title-text">${item.title}</span>`}
                        <span class="item-year-text">${item.release_date ? `(${item.release_date.substring(0, 4)})` : ''}</span>
                    </div>
                `;
                itemBlock.appendChild(itHeader);
            }

            if (item.type === 'movie') {
                const movieRow = document.createElement('div');
                movieRow.className = 'movie-row';
                movieRow.appendChild(buildStatusDropdown(item.status || -1, (newStatus) => {
                    item.status = newStatus;
                    save(); render();
                }));
                const moviePlay = buildPlayDropdown(item, 1, 1);
                moviePlay.classList.add('btn-tiny');
                movieRow.appendChild(moviePlay);
                itemBlock.appendChild(movieRow);
            } else {
                if (!item.seasons || item.seasons.length === 0) {
                    const fetchBtn = document.createElement('button');
                    fetchBtn.className = 'action-btn btn-small';
                    fetchBtn.textContent = 'Haal seizoenen op (AniList)';
                    fetchBtn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        // Gebruik de nieuwe AniList sync logic
                        await AnilistApi.fetchMediaDetails(item.anilist_id).then(details => {
                            if (details) {
                                item.seasons = [{ number: 1, name: 'Season 1', episodes: [] }];
                                for (let i = 1; i <= (details.episodes || 0); i++) {
                                    item.seasons[0].episodes.push({ number: i, name: `Episode ${i}`, status: -1 });
                                }
                                save(); render();
                                if (currentView === 'grid') Modals.showDetailModal(group);
                            }
                        });
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

    /**
     * Builds a single season row with accordion functionality for episodes.
     * @param {Object} item - The parent anime item.
     * @param {Object} season - The target season object.
     * @returns {HTMLElement} The season block.
     */
    function buildSeasonRow(item, season) {
        const seasonKey = `${item.title}-S${season.number}`;
        const isOpen = expandedSeasons.has(seasonKey);
        const sBlock = document.createElement('div');
        sBlock.className = 'season-block';
        if (season.number === 0) sBlock.classList.add('season-specials');

        const sHeader = document.createElement('div');
        sHeader.className = 'season-header';
        sHeader.appendChild(buildStatusDropdown(window.StatusCalculator.getSeasonStatus(season), (newStatus) => {
            setSeasonStatus(item, season, newStatus);
            save(); render();
        }));

        const sTitle = document.createElement('span');
        sTitle.className = 'season-title';
        const sName = season.number === 0 ? 'Specials' : (season.name || `Season ${season.number}`);
        sTitle.textContent = `${sName} (${season.episodes.length} afl.)`;
        sHeader.appendChild(sTitle);
        
        const sChevron = document.createElement('i');
        sChevron.className = `fas fa-chevron-${isOpen ? 'up' : 'down'} expand-icon`;
        sHeader.appendChild(sChevron);

        sHeader.addEventListener('click', (e) => {
            e.stopPropagation();
            if (e.target.closest('.status-dropdown, .action-btn')) return;
            if (expandedSeasons.has(seasonKey)) expandedSeasons.delete(seasonKey);
            else expandedSeasons.add(seasonKey);
            render();
            if (window.currentlyShownItem) Modals.showDetailModal(window.currentlyShownItem);
        });
        sBlock.appendChild(sHeader);

        if (isOpen) {
            const epList = document.createElement('div');
            epList.className = 'episode-list';
            season.episodes.forEach(ep => {
                const epRow = document.createElement('div');
                epRow.className = 'episode-row';
                if (selectedEpisodes.has(`${item.title}|S${season.number}|E${ep.number}`)) epRow.classList.add('selected');
                
                epRow.appendChild(buildStatusDropdown(ep.status, (newStatus) => {
                    setEpisodeStatus(item, season, ep, newStatus);
                    save(); render();
                }));
                
                const epTitle = document.createElement('span');
                epTitle.className = 'ep-title';
                epTitle.textContent = `E${ep.number} — ${ep.name}`;
                epRow.appendChild(epTitle);
                
                const epPlay = buildPlayDropdown(item, season.number, ep.number);
                epPlay.classList.add('btn-tiny');
                epRow.appendChild(epPlay);

                epRow.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (e.target.closest('.status-dropdown, .btn-play')) return;
                    const key = `${item.title}|S${season.number}|E${ep.number}`;
                    if (e.ctrlKey) {
                        if (selectedEpisodes.has(key)) {
                            selectedEpisodes.delete(key);
                            epRow.classList.remove('selected');
                        } else {
                            selectedEpisodes.set(key, { item, season, episode: ep });
                            epRow.classList.add('selected');
                        }
                        BatchActions.renderBatchBar(e.clientX, e.clientY);
                    }
                });
                epList.appendChild(epRow);
            });
            sBlock.appendChild(epList);
        }
        return sBlock;
    }

    return {
        buildStatusDropdown,
        buildCard,
        buildDetailGroup,
        buildSeasonRow
    };
})();

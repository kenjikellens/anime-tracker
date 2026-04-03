// domein/Components.js
window.Components = (function() {

    /**
     * Geeft het globale dropdown-menu terug.
     *
     * @returns {HTMLElement|null}
     */
    function getGlobalStatusMenu() {
        const menu = document.getElementById('global-status-menu');
        if (!menu) {
            console.warn('[Components] global-status-menu ontbreekt.');
            return null;
        }
        return menu;
    }

    /**
     * Sluit het globale dropdown-menu en ruimt de gekoppelde open-state op.
     *
     * @returns {void}
     */
    function closeGlobalStatusMenu() {
        const menu = getGlobalStatusMenu();
        if (!menu) {
            return;
        }

        menu.style.display = 'none';
        menu.innerHTML = '';

        if (menu._ownerButton instanceof HTMLElement) {
            menu._ownerButton.setAttribute('aria-expanded', 'false');
        }

        if (menu._ownerDropdown instanceof HTMLElement) {
            menu._ownerDropdown.classList.remove('open');
        }

        if (menu._ownerCard instanceof HTMLElement) {
            menu._ownerCard.classList.remove('has-open-dropdown');
        }

        menu._ownerButton = null;
        menu._ownerDropdown = null;
        menu._ownerCard = null;
    }

    /**
     * Positioneert het globale menu ten opzichte van een ankerknop.
     *
     * @param {HTMLElement} menu
     * @param {HTMLElement} anchor
     * @param {number} estimatedHeight
     * @returns {void}
     */
    function positionGlobalMenu(menu, anchor, estimatedHeight) {
        const rect = anchor.getBoundingClientRect();
        const menuWidth = 160;

        let left = rect.left;
        if (left + menuWidth > window.innerWidth) {
            left = rect.right - menuWidth;
        }
        if (left < 0) {
            left = 10;
        }

        let top = rect.bottom + 4;
        if (top + estimatedHeight > window.innerHeight) {
            top = rect.top - estimatedHeight - 4;
        }

        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
    }

    /**
     * Zet een posterpad om naar een bruikbare afbeeldings-URL.
     *
     * @param {string} posterPath
     * @returns {string|null}
     */
    function resolvePosterUrl(posterPath) {
        if (!posterPath) {
            return null;
        }
        return posterPath.startsWith('http')
            ? posterPath
            : `https://image.tmdb.org/t/p/w500${posterPath}`;
    }

    /**
     * Bouwt een herbruikbaar status-dropdown-element.
     *
     * @param {number} currentStatus
     * @param {function(number): void} onChange
     * @returns {HTMLElement}
     */
    function buildStatusDropdown(currentStatus, onChange) {
        const div = document.createElement('div');
        div.className = 'status-dropdown';
        div.innerHTML = `
            <button class="status-current" title="${UIHelpers.statusLabel(currentStatus)}" aria-haspopup="true" aria-expanded="false" type="button">
                <span style="display:flex; align-items:center; gap:8px;">
                    <i class="${UIHelpers.statusIcon(currentStatus)}"></i> <span>${UIHelpers.statusLabel(currentStatus)}</span>
                </span>
                <i class="fas fa-chevron-down" style="font-size: 10px; opacity: 0.6;"></i>
            </button>
        `;

        const button = div.querySelector('.status-current');
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            event.preventDefault();

            const globalMenu = getGlobalStatusMenu();
            if (!globalMenu) {
                return;
            }

            const isSameButtonOpen = globalMenu.style.display === 'flex' && globalMenu._ownerButton === button;
            closeGlobalStatusMenu();
            if (isSameButtonOpen) {
                return;
            }

            globalMenu.innerHTML = `
                <div class="status-option" data-val="-1"><i class="fas fa-clock" style="opacity:0.7;"></i> Te Bekijken</div>
                <div class="status-option" data-val="0"><i class="fas fa-play" style="opacity:0.7;"></i> Bezig</div>
                <div class="status-option" data-val="1"><i class="fas fa-check" style="opacity:0.7;"></i> Bekeken</div>
            `;

            const ownerCard = div.closest('.anime-card');
            if (ownerCard) {
                ownerCard.classList.add('has-open-dropdown');
            }

            div.classList.add('open');
            button.setAttribute('aria-expanded', 'true');
            globalMenu._ownerButton = button;
            globalMenu._ownerDropdown = div;
            globalMenu._ownerCard = ownerCard;
            globalMenu.style.display = 'flex';
            positionGlobalMenu(globalMenu, button, 130);

            globalMenu.querySelectorAll('.status-option').forEach((option) => {
                option.onclick = (clickEvent) => {
                    clickEvent.stopPropagation();
                    closeGlobalStatusMenu();
                    onChange(Number.parseInt(option.dataset.val, 10));
                };
            });
        });
        return div;
    }

    /**
     * Bouwt een dropdown voor playbackbronnen.
     *
     * @param {Object} item
     * @param {number} seasonNumber
     * @param {number} episodeNumber
     * @returns {HTMLElement}
     */
    function buildPlayDropdown(item, seasonNumber, episodeNumber) {
        const button = document.createElement('button');
        button.className = 'action-btn btn-play';
        button.innerHTML = '<i class="fas fa-play"></i>';
        button.title = item?.tmdb_id ? 'Kies een bron om te kijken' : 'Geen TMDB-bron beschikbaar';
        button.disabled = !item?.tmdb_id;

        button.addEventListener('click', (event) => {
            event.stopPropagation();
            event.preventDefault();

            if (!item?.tmdb_id) {
                return;
            }

            const globalMenu = getGlobalStatusMenu();
            if (!globalMenu) {
                return;
            }

            closeGlobalStatusMenu();

            globalMenu.innerHTML = Object.entries(EMBED_SOURCES).map(([key, source]) => `
                <div class="status-option" data-key="${key}">
                    <i class="fas fa-external-link-alt" style="opacity:0.7;"></i> ${source.label}
                </div>
            `).join('');

            globalMenu.style.display = 'flex';
            positionGlobalMenu(globalMenu, button, Object.keys(EMBED_SOURCES).length * 40);

            globalMenu.querySelectorAll('.status-option').forEach((option) => {
                option.onclick = (clickEvent) => {
                    clickEvent.stopPropagation();
                    const source = EMBED_SOURCES[option.dataset.key];
                    const url = item.type === 'movie'
                        ? source.movie(item.tmdb_id)
                        : source.tv(item.tmdb_id, seasonNumber, episodeNumber);
                    if (url) {
                        window.open(url, '_blank', 'noopener,noreferrer');
                    }
                    closeGlobalStatusMenu();
                };
            });
        });
        return button;
    }

    /**
     * Bouwt een anime-kaart voor een franchise-groep.
     *
     * @param {Object} group
     * @param {number} computedStatus
     * @returns {HTMLElement}
     */
    function buildCard(group, computedStatus) {
        const card = document.createElement('div');
        card.className = 'anime-card';
        card.dataset.status = computedStatus;

        if (!group || !Array.isArray(group.items) || group.items.length === 0) {
            return card;
        }

        if (computedStatus === 1) {
            card.classList.add('status-watched');
        }
        if (group.rating >= 9) {
            card.classList.add('glow-gold');
        } else if (group.rating >= 0 && group.rating < 2) {
            card.classList.add('glow-red');
        }

        const posterContainer = document.createElement('div');
        posterContainer.className = 'card-poster';
        const posterUrl = resolvePosterUrl(group.poster_path);
        if (posterUrl) {
            posterContainer.innerHTML = `<img src="${posterUrl}" alt="${group.title}" loading="lazy">`;
        } else {
            posterContainer.innerHTML = '<div class="poster-placeholder"><i class="fas fa-image"></i></div>';
        }
        card.appendChild(posterContainer);

        const info = document.createElement('div');
        info.className = 'card-info';
        info.innerHTML = `
            <div class="card-header">
                <div class="card-title">
                    <span>${group.title}</span>
                </div>
            </div>
        `;
        card.appendChild(info);

        if (group.rating >= 0) {
            const badge = document.createElement('div');
            badge.className = `rating-badge ${UIHelpers.getRatingClass(group.rating)}`;
            badge.innerHTML = `<i class="fas fa-star"></i> ${group.rating}`;
            card.appendChild(badge);
        }

        const chevron = document.createElement('i');
        chevron.className = 'fas fa-chevron-right expand-icon';
        card.appendChild(chevron);

        card.style.cursor = 'pointer';
        card.addEventListener('click', () => {
            Modals.showDetailModal(group);
        });
        return card;
    }

    /**
     * Bouwt het detailblok voor een franchise in de modal.
     *
     * @param {Object} group
     * @returns {HTMLElement}
     */
    function buildDetailGroup(group) {
        const detail = document.createElement('div');
        detail.className = 'card-detail-group card-detail';
        const sortedItems = [...group.items].sort((a, b) => {
            const da = a.release_date || '0000-00-00';
            const db = b.release_date || '0000-00-00';
            return da.localeCompare(db);
        });

        sortedItems.forEach((item) => {
            const itemBlock = document.createElement('div');
            itemBlock.className = 'item-block';
            const itemHeader = document.createElement('div');
            itemHeader.className = 'item-header';
            const lowerItem = item.title.toLowerCase();
            const lowerGroup = group.title.toLowerCase();
            const isRedundantTitle = lowerItem === lowerGroup || lowerItem.includes(lowerGroup) || lowerGroup.includes(lowerItem);

            if (!isRedundantTitle || group.items.length > 1) {
                itemHeader.innerHTML = `
                    <div class="item-title-row">
                        <span class="item-type-badge">${item.type === 'movie' ? 'Film' : 'Serie'}</span>
                        ${isRedundantTitle ? '' : `<span class="item-title-text">${item.title}</span>`}
                        <span class="item-year-text">${item.release_date ? `(${item.release_date.substring(0, 4)})` : ''}</span>
                    </div>
                `;
                itemBlock.appendChild(itemHeader);
            }

            if (item.type === 'movie') {
                const movieRow = document.createElement('div');
                movieRow.className = 'movie-row';
                movieRow.appendChild(buildStatusDropdown(item.status || -1, (newStatus) => {
                    item.status = newStatus;
                    save();
                    render();
                }));

                const moviePlay = buildPlayDropdown(item, 1, 1);
                moviePlay.classList.add('btn-tiny');
                movieRow.appendChild(moviePlay);
                itemBlock.appendChild(movieRow);
            } else if (!item.seasons || item.seasons.length === 0) {
                const fetchButton = document.createElement('button');
                fetchButton.className = 'action-btn btn-small';
                fetchButton.textContent = 'Haal seizoenen op (AniList)';
                fetchButton.addEventListener('click', async (event) => {
                    event.stopPropagation();
                    const details = await AnilistApi.fetchMediaDetails(item.anilist_id);
                    if (!details) {
                        return;
                    }

                    item.seasons = [{ number: 1, name: 'Season 1', episodes: [] }];
                    for (let episodeNumber = 1; episodeNumber <= (details.episodes || 0); episodeNumber += 1) {
                        item.seasons[0].episodes.push({ number: episodeNumber, name: `Episode ${episodeNumber}`, status: -1 });
                    }
                    save();
                    render();
                    if (currentView === 'grid') {
                        Modals.showDetailModal(group);
                    }
                });
                itemBlock.appendChild(fetchButton);
            } else {
                item.seasons.forEach((season) => {
                    itemBlock.appendChild(buildSeasonRow(item, season));
                });
            }
            detail.appendChild(itemBlock);
        });
        return detail;
    }

    /**
     * Bouwt een enkele seizoenrij met accordiongedrag voor episodes.
     *
     * @param {Object} item
     * @param {Object} season
     * @returns {HTMLElement}
     */
    function buildSeasonRow(item, season) {
        const seasonKey = `${item.title}-S${season.number}`;
        const isOpen = expandedSeasons.has(seasonKey);
        const seasonBlock = document.createElement('div');
        seasonBlock.className = 'season-block';
        if (season.number === 0) {
            seasonBlock.classList.add('season-specials');
        }

        const seasonHeader = document.createElement('div');
        seasonHeader.className = 'season-header';
        seasonHeader.appendChild(buildStatusDropdown(window.StatusCalculator.getSeasonStatus(season), (newStatus) => {
            setSeasonStatus(item, season, newStatus);
            save();
            render();
        }));

        const seasonTitle = document.createElement('span');
        seasonTitle.className = 'season-title';
        const seasonName = season.number === 0 ? 'Specials' : (season.name || `Season ${season.number}`);
        seasonTitle.textContent = `${seasonName} (${season.episodes.length} afl.)`;
        seasonHeader.appendChild(seasonTitle);

        const seasonChevron = document.createElement('i');
        seasonChevron.className = `fas fa-chevron-${isOpen ? 'up' : 'down'} expand-icon`;
        seasonHeader.appendChild(seasonChevron);

        seasonHeader.addEventListener('click', (event) => {
            event.stopPropagation();
            if (event.target.closest('.status-dropdown, .action-btn')) {
                return;
            }
            if (expandedSeasons.has(seasonKey)) {
                expandedSeasons.delete(seasonKey);
            } else {
                expandedSeasons.add(seasonKey);
            }
            render();
            if (window.currentlyShownItem) {
                Modals.showDetailModal(window.currentlyShownItem);
            }
        });
        seasonBlock.appendChild(seasonHeader);

        if (isOpen) {
            const episodeList = document.createElement('div');
            episodeList.className = 'episode-list';
            season.episodes.forEach((episode) => {
                const episodeRow = document.createElement('div');
                episodeRow.className = 'episode-row';
                if (selectedEpisodes.has(`${item.title}|S${season.number}|E${episode.number}`)) {
                    episodeRow.classList.add('selected');
                }

                episodeRow.appendChild(buildStatusDropdown(episode.status, (newStatus) => {
                    setEpisodeStatus(item, season, episode, newStatus);
                    save();
                    render();
                }));

                const episodeTitle = document.createElement('span');
                episodeTitle.className = 'ep-title';
                episodeTitle.textContent = `E${episode.number} - ${episode.name}`;
                episodeRow.appendChild(episodeTitle);

                const episodePlay = buildPlayDropdown(item, season.number, episode.number);
                episodePlay.classList.add('btn-tiny');
                episodeRow.appendChild(episodePlay);

                episodeRow.addEventListener('click', (event) => {
                    event.stopPropagation();
                    if (event.target.closest('.status-dropdown, .btn-play')) {
                        return;
                    }
                    const key = `${item.title}|S${season.number}|E${episode.number}`;
                    if (event.ctrlKey) {
                        if (selectedEpisodes.has(key)) {
                            selectedEpisodes.delete(key);
                            episodeRow.classList.remove('selected');
                        } else {
                            selectedEpisodes.set(key, { item, season, episode });
                            episodeRow.classList.add('selected');
                        }
                        BatchActions.renderBatchBar(event.clientX, event.clientY);
                    }
                });
                episodeList.appendChild(episodeRow);
            });
            seasonBlock.appendChild(episodeList);
        }
        return seasonBlock;
    }

    return {
        closeGlobalStatusMenu,
        buildStatusDropdown,
        buildPlayDropdown,
        buildCard,
        buildDetailGroup,
        buildSeasonRow
    };
})();

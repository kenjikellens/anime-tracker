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
     * Bouwt een progress-control met [ - ] progress / total [ + ] knoppen.
     *
     * @param {Object} item - Het anime-item
     * @param {Object} group - De franchise-groep (voor re-render)
     * @returns {HTMLElement}
     */
    function buildProgressControl(item, group) {
        const container = document.createElement('div');
        container.className = 'progress-control';

        const total = item.episodes || '?';
        const current = item.progress || 0;

        const minusBtn = document.createElement('button');
        minusBtn.className = 'progress-btn';
        minusBtn.innerHTML = '<i class="fas fa-minus"></i>';
        minusBtn.disabled = current <= 0;
        minusBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            window.AnimeActions.decrementProgress(item);
            triggerAutoSync(item);
            save();
            render();
            if (window.currentlyShownItem) {
                Modals.showDetailModal(window.currentlyShownItem);
            }
        });

        const progressText = document.createElement('span');
        progressText.className = 'progress-text';
        progressText.textContent = `${current} / ${total}`;

        const plusBtn = document.createElement('button');
        plusBtn.className = 'progress-btn';
        plusBtn.innerHTML = '<i class="fas fa-plus"></i>';
        plusBtn.disabled = (typeof total === 'number' && current >= total);
        plusBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            window.AnimeActions.incrementProgress(item);
            triggerAutoSync(item);
            save();
            render();
            if (window.currentlyShownItem) {
                Modals.showDetailModal(window.currentlyShownItem);
            }
        });

        container.appendChild(minusBtn);
        container.appendChild(progressText);
        container.appendChild(plusBtn);

        return container;
    }

    /**
     * Bouwt het detailblok voor een franchise in de modal.
     * Toont een lijst van seizoenen/films MET progress-controls (geen episode-grid).
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

            // Item header met type-badge, titel en jaar
            const itemHeader = document.createElement('div');
            itemHeader.className = 'item-header';

            const lowerItem = item.title.toLowerCase();
            const lowerGroup = group.title.toLowerCase();
            const isRedundantTitle = lowerItem === lowerGroup || lowerItem.includes(lowerGroup) || lowerGroup.includes(lowerItem);

            // Toon altijd de header als er meerdere items zijn, of als de titel verschilt
            if (!isRedundantTitle || group.items.length > 1) {
                itemHeader.innerHTML = `
                    <div class="item-title-row">
                        <span class="item-type-badge">${item.type === 'movie' ? 'Film' : item._format || 'Serie'}</span>
                        ${isRedundantTitle ? '' : `<span class="item-title-text">${item.title}</span>`}
                        <span class="item-year-text">${item.release_date ? `(${item.release_date.substring(0, 4)})` : ''}</span>
                    </div>
                `;
                itemBlock.appendChild(itemHeader);
            }

            // Item actions row: Status + Progress + Play
            const actionsRow = document.createElement('div');
            actionsRow.className = 'item-actions-row';

            // Status dropdown
            actionsRow.appendChild(buildStatusDropdown(
                window.StatusCalculator.getAnimeStatus(item),
                (newStatus) => {
                    window.AnimeActions.setStatusLocally(item, newStatus);
                    triggerAutoSync(item);
                    save();
                    render();
                    if (window.currentlyShownItem) {
                        Modals.showDetailModal(window.currentlyShownItem);
                    }
                }
            ));

            // Progress control (niet voor movies zonder episodes)
            if (item.type !== 'movie') {
                actionsRow.appendChild(buildProgressControl(item, group));
            }

            // Play button
            const nextEp = (item.progress || 0) + 1;
            const playBtn = buildPlayDropdown(item, 1, nextEp);
            playBtn.classList.add('btn-tiny');
            actionsRow.appendChild(playBtn);

            itemBlock.appendChild(actionsRow);
            detail.appendChild(itemBlock);
        });

        return detail;
    }

    return {
        closeGlobalStatusMenu,
        buildStatusDropdown,
        buildPlayDropdown,
        buildCard,
        buildDetailGroup,
        buildProgressControl
    };
})();

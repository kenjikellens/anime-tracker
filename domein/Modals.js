// domein/Modals.js
window.Modals = (function() {

    let currentItem = null;
    let ratingChangeStatus = false;
    let listenersInitialized = false;

    /**
     * Leest een modal-element veilig op.
     *
     * @param {string} id
     * @returns {HTMLElement|null}
     */
    function getModalElement(id) {
        const element = document.getElementById(id);
        if (!element) {
            console.warn(`[Modals] Element "${id}" niet gevonden.`);
            return null;
        }
        return element;
    }

    /**
     * Zet een posterpad om naar een bruikbare URL.
     *
     * @param {string} posterPath
     * @returns {string}
     */
    function resolvePosterUrl(posterPath) {
        if (!posterPath) {
            return 'assets/placeholder-v.png';
        }
        return posterPath.startsWith('http')
            ? posterPath
            : `https://image.tmdb.org/t/p/w500${posterPath}`;
    }

    /**
     * Opent de beoordelingsmodal voor het gegeven anime-item.
     *
     * @param {Object} item
     * @param {boolean} [changeStatus=true]
     * @returns {void}
     */
    function showRatingModal(item, changeStatus = true) {
        if (!item) {
            return;
        }

        const titleElement = getModalElement('modal-title');
        const ratingInput = getModalElement('rating-number');
        const overlay = getModalElement('modal-overlay');
        if (!titleElement || !ratingInput || !overlay) {
            return;
        }

        currentItem = item;
        ratingChangeStatus = changeStatus;
        titleElement.textContent = item.title;
        ratingInput.value = (item.rating !== undefined && item.rating > -1) ? item.rating.toFixed(1) : '7.0';
        overlay.classList.remove('hidden');
    }

    /**
     * Opent de detail-modal voor een franchise-groep.
     *
     * @param {Object} group
     * @returns {void}
     */
    function showDetailModal(group) {
        try {
            if (!group || !Array.isArray(group.items) || group.items.length === 0) {
                throw new Error('Geen geldige detailgroep beschikbaar.');
            }

            window.currentlyShownItem = group;
            const modalElement = document.querySelector('.modal-detail');
            const overlay = getModalElement('detail-overlay');
            if (!modalElement || !overlay) {
                throw new Error('Detail modal not found');
            }
            modalElement.innerHTML = '';

            const layout = document.createElement('div');
            layout.className = 'modal-body-layout';

            const sidebar = document.createElement('div');
            sidebar.className = 'modal-sidebar';
            const poster = document.createElement('img');
            poster.className = 'modal-sidebar-poster';
            poster.src = resolvePosterUrl(group.poster_path);
            poster.alt = group.title || 'Poster';
            sidebar.appendChild(poster);
            layout.appendChild(sidebar);

            const main = document.createElement('div');
            main.className = 'modal-main';

            const header = document.createElement('div');
            header.className = 'modal-detail-header';

            const closeRow = document.createElement('div');
            closeRow.className = 'modal-close-row';
            const closeButton = document.createElement('button');
            closeButton.className = 'btn-close';
            closeButton.innerHTML = '&times;';
            closeButton.addEventListener('click', () => {
                window.currentlyShownItem = null;
                overlay.classList.add('hidden');
            });
            closeRow.appendChild(closeButton);
            header.appendChild(closeRow);

            const titleElement = document.createElement('h1');
            titleElement.id = 'detail-title';
            titleElement.innerHTML = `<span>${group.title}</span>`;
            header.appendChild(titleElement);

            const overallStatus = group._computedStatus !== undefined ? group._computedStatus : -1;
            let playItem = group.items[0];
            let playSeason = 1;
            let playEpisode = 1;

            if (group.items && Array.isArray(group.items)) {
                findNext: for (const item of group.items) {
                    if (window.StatusCalculator.getAnimeStatus(item) !== 1) {
                        playItem = item;
                        if (item.seasons) {
                            for (const season of item.seasons) {
                                const unwatched = (season.episodes || []).find((episode) => episode.status !== 1);
                                if (unwatched) {
                                    playSeason = season.number;
                                    playEpisode = unwatched.number;
                                    break findNext;
                                }
                            }
                        }
                        break;
                    }
                }
            }

            const actionContainer = document.createElement('div');
            actionContainer.className = 'modal-global-actions';

            const topDropdown = Components.buildStatusDropdown(overallStatus, (newStatus) => {
                group.items.forEach((item) => window.setAnimeAllStatus(item, newStatus));
                window.save();
                window.render();
                showDetailModal(group);
            });
            actionContainer.appendChild(topDropdown);

            if (playItem) {
                const quickPlay = Components.buildPlayDropdown(playItem, playSeason, playEpisode);
                quickPlay.className += ' modal-play-btn';
                quickPlay.title = `Kijk verder: Seizoen ${playSeason} Afl. ${playEpisode}`;
                actionContainer.appendChild(quickPlay);
            }

            const ratingBadge = document.createElement('div');
            const isRated = group.rating !== undefined && group.rating > -1;
            const ratingClass = UIHelpers.getRatingClass(group.rating);
            ratingBadge.className = `rating-badge ${ratingClass}`;
            ratingBadge.style.cursor = 'pointer';
            ratingBadge.innerHTML = `<i class="fas fa-star" style="font-size:0.8em;"></i> ${isRated ? group.rating.toFixed(1) : '-'}`;
            ratingBadge.addEventListener('click', (event) => {
                event.stopPropagation();
                showRatingModal(group.items[0], false);
            });
            actionContainer.appendChild(ratingBadge);
            header.appendChild(actionContainer);
            main.appendChild(header);

            const content = document.createElement('div');
            content.id = 'detail-content';
            content.appendChild(Components.buildDetailGroup(group));
            main.appendChild(content);

            layout.appendChild(main);
            modalElement.appendChild(layout);
            overlay.classList.remove('hidden');
        } catch (error) {
            console.error('[Modals] showDetailModal failed:', error);
            alert(`Oeps! De pop-up kon niet laden: ${error.message}`);
        }
    }

    /**
     * Registreert modal-gerelateerde UI events.
     *
     * @returns {void}
     */
    function initEventListeners() {
        if (listenersInitialized) {
            return;
        }

        const cancelButton = getModalElement('cancel-rating');
        const saveButton = getModalElement('save-rating');
        const clearButton = getModalElement('clear-rating');
        const closeDetailButton = getModalElement('close-detail');
        const modalOverlay = getModalElement('modal-overlay');
        const detailOverlay = getModalElement('detail-overlay');
        const ratingInput = getModalElement('rating-number');

        if (!cancelButton || !saveButton || !clearButton || !closeDetailButton || !modalOverlay || !detailOverlay || !ratingInput) {
            return;
        }

        cancelButton.addEventListener('click', () => {
            modalOverlay.classList.add('hidden');
        });

        saveButton.addEventListener('click', () => {
            if (!currentItem) {
                return;
            }

            const raw = Number.parseFloat(ratingInput.value);
            const safeValue = Number.isFinite(raw) ? raw : 7;
            const clamped = Math.min(10, Math.max(0, safeValue));
            currentItem.rating = Math.round(clamped * 10) / 10;
            if (ratingChangeStatus) {
                setAnimeAllStatus(currentItem, 1);
            }
            save();
            render();
            modalOverlay.classList.add('hidden');
        });

        clearButton.addEventListener('click', () => {
            if (!currentItem) {
                return;
            }

            currentItem.rating = -1;
            save();
            render();
            modalOverlay.classList.add('hidden');
        });

        closeDetailButton.addEventListener('click', () => {
            window.currentlyShownItem = null;
            detailOverlay.classList.add('hidden');
        });

        detailOverlay.addEventListener('click', (event) => {
            if (event.target === event.currentTarget) {
                window.currentlyShownItem = null;
                detailOverlay.classList.add('hidden');
            }
        });

        listenersInitialized = true;
    }

    return {
        showRatingModal,
        showDetailModal,
        initEventListeners
    };
})();

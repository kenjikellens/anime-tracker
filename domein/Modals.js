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
     * Bepaalt de afgeleide groepsstatus op basis van de onderliggende items.
     *
     * @param {Object} group
     * @returns {number}
     */
    function getGroupOverallStatus(group) {
        const statuses = Array.isArray(group?.items)
            ? group.items.map((item) => window.StatusCalculator.getAnimeStatus(item))
            : [];

        if (statuses.every((s) => s === 1)) return 1;
        if (statuses.some((s) => s === 0 || s === 1)) return 0;
        return -1;
    }

    /**
     * Bepaalt de zichtbare groepsrating op basis van de itemratings.
     *
     * @param {Object} group
     * @returns {number}
     */
    function getGroupRating(group) {
        const ratings = Array.isArray(group?.items)
            ? group.items
                .map((item) => Number(item?.rating))
                .filter((rating) => Number.isFinite(rating) && rating >= 0)
            : [];

        return ratings.length > 0 ? Math.max(...ratings) : -1;
    }

    /**
     * Kiest het item dat de zichtbare groepsrating vertegenwoordigt.
     *
     * @param {Object} group
     * @param {number} groupRating
     * @returns {Object|null}
     */
    function getRatingTargetItem(group, groupRating) {
        if (!Array.isArray(group?.items) || group.items.length === 0) {
            return null;
        }

        return group.items.find((item) => Number(item?.rating) === groupRating) || group.items[0];
    }

    /**
     * Rondt een ingevoerde rating veilig af naar 0.0 - 10.0.
     *
     * @param {string} rawValue
     * @param {number} fallback
     * @returns {number}
     */
    function normalizeInlineRating(rawValue, fallback) {
        const normalized = String(rawValue || '').trim().replace(',', '.');
        if (!normalized) {
            return fallback;
        }

        const parsed = Number.parseFloat(normalized);
        if (!Number.isFinite(parsed)) {
            return fallback;
        }

        return Math.round(Math.min(10, Math.max(0, parsed)) * 10) / 10;
    }

    /**
     * Bouwt de ratingbadge in de detailmodal op, inclusief inline edit.
     *
     * @param {Object} group
     * @returns {HTMLButtonElement}
     */
    function buildInlineRatingBadge(group) {
        const currentRating = getGroupRating(group);
        const ratingTarget = getRatingTargetItem(group, currentRating);
        const ratingBadge = document.createElement('button');
        const isRated = currentRating > -1;
        const ratingClass = UIHelpers.getRatingClass(currentRating);

        ratingBadge.type = 'button';
        ratingBadge.className = `rating-badge modal-rating-btn ${ratingClass}`;
        ratingBadge.title = 'Pas rating aan';
        ratingBadge.innerHTML = `<i class="fas fa-star" style="font-size:0.8em;"></i> ${isRated ? currentRating.toFixed(1) : '-'}`;

        ratingBadge.addEventListener('click', (event) => {
            event.stopPropagation();

            if (!ratingTarget || ratingBadge.dataset.editing === 'true') {
                return;
            }

            ratingBadge.dataset.editing = 'true';
            ratingBadge.classList.add('is-editing');
            ratingBadge.innerHTML = '<i class="fas fa-star" style="font-size:0.8em;"></i>';

            const input = document.createElement('input');
            input.type = 'number';
            input.min = '0';
            input.max = '10';
            input.step = '0.1';
            input.inputMode = 'decimal';
            input.className = 'rating-inline-input';
            input.placeholder = '-';
            input.value = isRated ? currentRating.toFixed(1) : '';
            ratingBadge.appendChild(input);

            let finished = false;

            const finalize = (shouldPersist) => {
                if (finished) {
                    return;
                }
                finished = true;

                document.removeEventListener('pointerdown', handleOutsidePointer, true);
                input.removeEventListener('blur', handleBlur);
                input.removeEventListener('keydown', handleKeyDown);

                if (!shouldPersist) {
                    showDetailModal(group);
                    return;
                }

                ratingTarget.rating = normalizeInlineRating(input.value, ratingTarget.rating);
                // Push rating naar AniList
                triggerAutoSync(ratingTarget);
                Promise.resolve(save()).finally(() => {
                    render();
                    window.setTimeout(() => {
                        const detailOverlay = getModalElement('detail-overlay');
                        if (window.currentlyShownItem && detailOverlay && !detailOverlay.classList.contains('hidden')) {
                            showDetailModal(group);
                        }
                    }, 0);
                });
            };

            const handleOutsidePointer = (pointerEvent) => {
                if (!ratingBadge.contains(pointerEvent.target)) {
                    finalize(true);
                }
            };

            const handleBlur = () => {
                window.setTimeout(() => {
                    if (!ratingBadge.contains(document.activeElement)) {
                        finalize(true);
                    }
                }, 0);
            };

            const handleKeyDown = (keyboardEvent) => {
                if (keyboardEvent.key === 'Enter') {
                    keyboardEvent.preventDefault();
                    finalize(true);
                    return;
                }

                if (keyboardEvent.key === 'Escape') {
                    keyboardEvent.preventDefault();
                    finalize(false);
                }
            };

            input.addEventListener('blur', handleBlur);
            input.addEventListener('keydown', handleKeyDown);

            window.setTimeout(() => {
                document.addEventListener('pointerdown', handleOutsidePointer, true);
            }, 0);

            input.focus();
            input.select();
        });

        return ratingBadge;
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
     * Vereenvoudigd voor het AniList-model: geen seizoen/episode grid meer.
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

            const overallStatus = getGroupOverallStatus(group);

            // Vind het volgende item om te kijken (eerste niet-complete item)
            let playItem = group.items[0];
            let playEpisode = 1;

            for (const item of group.items) {
                if (window.StatusCalculator.getAnimeStatus(item) !== 1) {
                    playItem = item;
                    playEpisode = (item.progress || 0) + 1;
                    break;
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
                const quickPlay = Components.buildPlayDropdown(playItem, 1, playEpisode);
                quickPlay.className += ' modal-play-btn';
                quickPlay.title = `Kijk verder: Afl. ${playEpisode}`;
                actionContainer.appendChild(quickPlay);
            }

            const ratingBadge = buildInlineRatingBadge(group);
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
                window.AnimeActions.setStatusLocally(currentItem, 1);
            }
            triggerAutoSync(currentItem);
            save();
            render();
            modalOverlay.classList.add('hidden');
        });

        clearButton.addEventListener('click', () => {
            if (!currentItem) {
                return;
            }

            currentItem.rating = -1;
            triggerAutoSync(currentItem);
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

// domein/Modals.js
window.Modals = (function() {

    let currentItem = null;
    let ratingChangeStatus = false;

    /**
     * Opent de beoordelingsmodal voor het gegeven anime-item.
     * @param {Object} item - Het item dat beoordeeld wordt
     * @param {boolean} [changeStatus=true] - Als true wordt de status ook op 'Bekeken' gezet bij opslaan
     */
    function showRatingModal(item, changeStatus = true) {
        currentItem = item;
        ratingChangeStatus = changeStatus;
        document.getElementById('modal-title').textContent = item.title;
        document.getElementById('rating-number').value = (item.rating !== undefined && item.rating > -1) ? item.rating.toFixed(1) : '7.0';
        document.getElementById('modal-overlay').classList.remove('hidden');
    }

    /**
     * Opent de detail-modal voor een franchise-groep.
     * @param {Object} group - Franchise-groepsobject
     */
    function showDetailModal(group) {
        try {
            window.currentlyShownItem = group;
            const modalEl = document.querySelector('.modal-detail');
            if (!modalEl) throw new Error('Detail modal not found!');
            modalEl.innerHTML = ''; // Fresh start

            const layout = document.createElement('div');
            layout.className = 'modal-body-layout';

            // Column 1: Sidebar (Poster)
            const sidebar = document.createElement('div');
            sidebar.className = 'modal-sidebar';
            const poster = document.createElement('img');
            poster.className = 'modal-sidebar-poster';
            // Use the same poster resolution logic as the cards
            poster.src = group.poster_path ? `https://image.tmdb.org/t/p/w500${group.poster_path}` : 'assets/placeholder-v.png';
            sidebar.appendChild(poster);
            layout.appendChild(sidebar);

            // Column 2: Main Content
            const main = document.createElement('div');
            main.className = 'modal-main';

            // --- Header (3-row structure) ---
            const header = document.createElement('div');
            header.className = 'modal-detail-header';

            // Row 1: Close
            const closeRow = document.createElement('div');
            closeRow.className = 'modal-close-row';
            const closeBtn = document.createElement('button');
            closeBtn.className = 'btn-close';
            closeBtn.innerHTML = '&times;';
            closeBtn.addEventListener('click', () => {
                window.currentlyShownItem = null;
                document.getElementById('detail-overlay').classList.add('hidden');
            });
            closeRow.appendChild(closeBtn);
            header.appendChild(closeRow);

            // Row 2: Title
            const titleEl = document.createElement('h1');
            titleEl.id = 'detail-title';
            titleEl.innerHTML = `<span>${group.title}</span>`;
            header.appendChild(titleEl);

            // Row 3: Actions
            const overallStatus = group._computedStatus !== undefined ? group._computedStatus : -1;
            let playItem = group.items[0], sP = 1, eP = 1;
            if (group.items && Array.isArray(group.items)) {
                findNext: for (const it of group.items) {
                    if (window.StatusCalculator.getAnimeStatus(it) !== 1) {
                        playItem = it;
                        if (it.seasons) {
                            for (const season of it.seasons) {
                                const unwatched = (season.episodes || []).find(ep => ep.status !== 1);
                                if (unwatched) { sP = season.number; eP = unwatched.number; break findNext; }
                            }
                        }
                        break;
                    }
                }
            }

            const actionContainer = document.createElement('div');
            actionContainer.className = 'modal-global-actions';

            // Status Dropdown
            const topDd = Components.buildStatusDropdown(overallStatus, (newStatus) => {
                group.items.forEach(item => window.setAnimeAllStatus(item, newStatus));
                window.save(); window.render();
                showDetailModal(group);
            });
            actionContainer.appendChild(topDd);

            // Quick Play
            if (playItem) {
                const quickPlay = Components.buildPlayDropdown(playItem, sP, eP);
                quickPlay.className += ' modal-play-btn';
                quickPlay.title = `Kijk verder: Seizoen ${sP} Afl. ${eP}`;
                actionContainer.appendChild(quickPlay);
            }

            // Rating Badge
            const ratingBadge = document.createElement('div');
            const isRated = group.rating !== undefined && group.rating > -1;
            const rClass = UIHelpers.getRatingClass(group.rating);
            ratingBadge.className = `rating-badge ${rClass}`;
            ratingBadge.style.cursor = 'pointer';
            ratingBadge.innerHTML = `<i class="fas fa-star" style="font-size:0.8em;"></i> ${isRated ? group.rating.toFixed(1) : '—'}`;
            ratingBadge.addEventListener('click', (e) => {
                e.stopPropagation();
                showRatingModal(group.items[0], false);
            });
            actionContainer.appendChild(ratingBadge);
            header.appendChild(actionContainer);
            main.appendChild(header);

            // --- Body (Seasons List) ---
            const content = document.createElement('div');
            content.id = 'detail-content';
            content.appendChild(Components.buildDetailGroup(group));
            main.appendChild(content);

            layout.appendChild(main);
            modalEl.appendChild(layout);

            document.getElementById('detail-overlay').classList.remove('hidden');
        } catch (err) {
            console.error('[Modals] showDetailModal failed:', err);
            alert('Oeps! De pop-up kon niet laden: ' + err.message + '\n\nMaster, ik heb een foutje gemaakt! Nya! 🐾');
        }
    }

    function initEventListeners() {
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

        document.getElementById('close-detail').addEventListener('click', () => {
            window.currentlyShownItem = null;
            document.getElementById('detail-overlay').classList.add('hidden');
        });

        document.getElementById('detail-overlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                window.currentlyShownItem = null;
                document.getElementById('detail-overlay').classList.add('hidden');
            }
        });
    }

    return {
        showRatingModal,
        showDetailModal,
        initEventListeners
    };
})();

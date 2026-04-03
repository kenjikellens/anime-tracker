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
     * @param {Object} group - Franchise-groepsobject (Layer 1)
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
            poster.src = group.poster_path ? (group.poster_path.startsWith('http') ? group.poster_path : `https://image.tmdb.org/t/p/w500${group.poster_path}`) : 'assets/placeholder-v.png';
            sidebar.appendChild(poster);
            layout.appendChild(sidebar);

            // Column 2: Main Content
            const main = document.createElement('div');
            main.className = 'modal-main';

            // --- Header (3-row structure) ---
            const header = document.createElement('div');
            header.className = 'modal-detail-header';

            // Row 1: Close & Sync
            const topRow = document.createElement('div');
            topRow.className = 'modal-close-row';
            topRow.style.display = 'flex';
            topRow.style.justifyContent = 'space-between';
            topRow.style.alignItems = 'center';

            const syncBtn = document.createElement('button');
            syncBtn.className = 'action-btn btn-small';
            syncBtn.innerHTML = '<i class="fas fa-magic"></i> Franchise Synchroniseren';
            syncBtn.title = 'Zoek sequels, OVAs en films (zonder crossovers!)';
            syncBtn.onclick = async () => {
                syncBtn.disabled = true;
                syncBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Bezig...';
                const added = await AnilistApi.syncFranchise(group);
                syncBtn.innerHTML = `<i class="fas fa-check"></i> ${added} items toegevoegd!`;
                setTimeout(() => { showDetailModal(group); }, 1500);
            };
            topRow.appendChild(syncBtn);

            const closeBtn = document.createElement('button');
            closeBtn.className = 'btn-close';
            closeBtn.innerHTML = '&times;';
            closeBtn.addEventListener('click', () => {
                window.currentlyShownItem = null;
                document.getElementById('detail-overlay').classList.add('hidden');
            });
            topRow.appendChild(closeBtn);
            header.appendChild(topRow);

            // Row 2: Title
            const titleEl = document.createElement('h1');
            titleEl.id = 'detail-title';
            titleEl.innerHTML = `<span>${group.name}</span>`;
            header.appendChild(titleEl);

            // Row 3: Actions
            const overallStatus = group._computedStatus !== undefined ? group._computedStatus : -1;
            
            // Find next to play logic
            let playItem = group.items[0], sP = 1, eP = 1;
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

            const actionContainer = document.createElement('div');
            actionContainer.className = 'modal-global-actions';

            // Status Dropdown
            const topDd = Components.buildStatusDropdown(overallStatus, (newStatus) => {
                group.items.forEach(item => window.setAnimeAllStatus(group, item, newStatus));
                window.save(); window.render();
                showDetailModal(group);
            });
            actionContainer.appendChild(topDd);

            // Quick Play
            if (playItem) {
                const quickPlay = Components.buildPlayDropdown(playItem, sP, eP);
                quickPlay.className += ' modal-play-btn';
                quickPlay.title = `Kijk verder: S${sP} E${eP}`;
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
                // Pass the first item as a reference for the rating modal
                showRatingModal(group.items[0], group, false);
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

    /**
     * Opent de beoordelingsmodal.
     * @param {Object} item - Het item zelf.
     * @param {Object} group - De parent franchise.
     * @param {boolean} [changeStatus=true]
     */
    function showRatingModal(item, group, changeStatus = true) {
        currentItem = item;
        currentItem._parentFranchise = group; // Temporary ref
        ratingChangeStatus = changeStatus;
        document.getElementById('modal-title').textContent = item.title;
        document.getElementById('rating-number').value = (item.rating !== undefined && item.rating > -1) ? item.rating.toFixed(1) : '7.0';
        document.getElementById('modal-overlay').classList.remove('hidden');
    }

    function initEventListeners() {
        document.getElementById('cancel-rating').addEventListener('click', () => {
            document.getElementById('modal-overlay').classList.add('hidden');
        });

        document.getElementById('save-rating').addEventListener('click', () => {
            const raw = parseFloat(document.getElementById('rating-number').value || '7.0');
            const clamped = Math.min(10, Math.max(0, raw));
            currentItem.rating = Math.round(clamped * 10) / 10;
            
            const group = currentItem._parentFranchise;
            if (group) {
                if (ratingChangeStatus) setAnimeAllStatus(group, currentItem, 1);
                // Bubble up: update franchise rating
                group.rating = Math.max(...group.items.map(i => i.rating || -1));
            }
            
            save(); render();
            document.getElementById('modal-overlay').classList.add('hidden');
            if (group) showDetailModal(group);
        });

        document.getElementById('clear-rating').addEventListener('click', () => {
            currentItem.rating = -1;
            const group = currentItem._parentFranchise;
            if (group) group.rating = Math.max(...group.items.map(i => i.rating || -1));
            save(); render();
            document.getElementById('modal-overlay').classList.add('hidden');
            if (group) showDetailModal(group);
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

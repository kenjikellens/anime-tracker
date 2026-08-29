/**
 * Manages the "Top Kijkvolgorde / Volgende om te Bekijken" sidebar drawer.
 * Supports HTML5 Drag & Drop reordering and searchable autocomplete to add series.
 */
export class QueueManager {
    /**
     * Initializes the QueueManager and binds all DOM events.
     * @param {AnimeRepository} repository - The anime repository.
     * @param {Function} onUpdate - Callback fired whenever the queue order or contents change.
     * @returns {QueueManager} The initialized manager instance.
     */
    static setup(repository, onUpdate) {
        const manager = new QueueManager(repository, onUpdate);
        manager.init();
        return manager;
    }

    constructor(repository, onUpdate) {
        this.repository = repository;
        this.onUpdate = onUpdate;
        this.sidebarEl = document.getElementById('queue-sidebar');
        this.toggleBtn = document.getElementById('queue-toggle-btn');
        this.closeBtn = document.getElementById('queue-close-btn');
        this.listContainer = document.getElementById('queue-list-container');
        this.headerCountEl = document.getElementById('header-queue-count');
        this.sidebarCountEl = document.getElementById('sidebar-queue-count');
        this.searchAddInput = document.getElementById('queue-search-add');
        this.autocompleteList = document.getElementById('queue-autocomplete');
        this.mainContent = document.getElementById('app');

        this.draggedAnimeId = null;
    }

    /**
     * Binds all listeners and runs the initial render.
     */
    init() {
        if (this.toggleBtn) {
            this.toggleBtn.addEventListener('click', () => this.toggleSidebar());
        }
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.toggleSidebar(false));
        }

        this.setupSearchAdd();
        this.render();
    }

    /**
     * Toggles or sets the open state of the sidebar drawer.
     * @param {boolean} [forceState] - Optional explicit boolean state.
     */
    toggleSidebar(forceState) {
        if (!this.sidebarEl) return;
        const isOpen = forceState !== undefined ? forceState : !this.sidebarEl.classList.contains('open');
        this.sidebarEl.classList.toggle('open', isOpen);
        if (this.toggleBtn) {
            this.toggleBtn.classList.toggle('active', isOpen);
        }
        if (this.mainContent) {
            this.mainContent.classList.toggle('sidebar-open', isOpen);
        }
    }

    /**
     * Renders the current ranked list in the sidebar and updates count badges.
     */
    render() {
        const queue = this.repository.getRankedWatchQueue();

        if (this.headerCountEl) {
            this.headerCountEl.textContent = queue.length;
        }
        if (this.sidebarCountEl) {
            this.sidebarCountEl.textContent = queue.length;
        }

        if (!this.listContainer) return;

        if (queue.length === 0) {
            this.listContainer.innerHTML = `
                <div class="queue-empty-state">
                    <p>Nog geen anime in je Top Kijklijst.</p>
                    <p style="font-size: 11px;">Typ een serienaam hierboven of klik op "+ Naar Top Lijst" op een animekaart.</p>
                </div>
            `;
            return;
        }

        this.listContainer.innerHTML = queue.map((anime, index) => {
            const rank = index + 1;
            const isTop = rank === 1;
            return `
                <div class="queue-item" draggable="true" data-id="${anime.id}" data-index="${index}">
                    <div class="queue-drag-handle" title="Sleep om volgorde te wijzigen">⋮⋮</div>
                    <span class="queue-item-rank ${isTop ? 'rank-top' : ''}">#${rank}</span>
                    <span class="queue-item-title" title="${anime.title}">${anime.title}</span>
                    <div class="queue-item-actions">
                        <button class="queue-action-btn btn-remove" data-remove-id="${anime.id}" title="Verwijderen uit Top lijst">✕</button>
                    </div>
                </div>
            `;
        }).join('');

        this.bindItemEvents();
    }

    /**
     * Binds Drag & Drop and removal events to rendered queue items.
     */
    bindItemEvents() {
        if (!this.listContainer) return;

        // Removal buttons
        const removeBtns = this.listContainer.querySelectorAll('[data-remove-id]');
        removeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const animeId = btn.getAttribute('data-remove-id');
                this.repository.removeFromWatchQueue(animeId);
                this.render();
                if (this.onUpdate) this.onUpdate();
            });
        });

        // HTML5 Drag & Drop handlers
        const items = this.listContainer.querySelectorAll('.queue-item');
        items.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                this.draggedAnimeId = item.getAttribute('data-id');
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', this.draggedAnimeId);
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                items.forEach(i => {
                    i.classList.remove('drag-over');
                    i.classList.remove('drag-over-bottom');
                });
                this.draggedAnimeId = null;
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';

                const rect = item.getBoundingClientRect();
                const offset = e.clientY - rect.top;
                if (offset < rect.height / 2) {
                    item.classList.add('drag-over');
                    item.classList.remove('drag-over-bottom');
                } else {
                    item.classList.add('drag-over-bottom');
                    item.classList.remove('drag-over');
                }
            });

            item.addEventListener('dragleave', () => {
                item.classList.remove('drag-over');
                item.classList.remove('drag-over-bottom');
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                const targetId = item.getAttribute('data-id');
                if (!this.draggedAnimeId || this.draggedAnimeId === targetId) return;

                const queue = this.repository.getRankedWatchQueue();
                const fromIndex = queue.findIndex(a => a.id === this.draggedAnimeId);
                let toIndex = queue.findIndex(a => a.id === targetId);

                const rect = item.getBoundingClientRect();
                const offset = e.clientY - rect.top;
                if (offset >= rect.height / 2) {
                    toIndex += 1;
                }

                if (fromIndex < 0 || toIndex < 0) return;
                if (toIndex > fromIndex) toIndex -= 1;

                this.repository.reorderWatchRank(fromIndex, toIndex);
                this.render();
                if (this.onUpdate) this.onUpdate();
            });
        });
    }

    /**
     * Sets up the searchable autocomplete input to add unranked series.
     */
    setupSearchAdd() {
        if (!this.searchAddInput || !this.autocompleteList) return;

        this.searchAddInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            if (!query) {
                this.autocompleteList.classList.remove('visible');
                return;
            }

            const unqueued = this.repository.getAll().filter(a => {
                const notInQueue = !(typeof a.watchRank === 'number' && a.watchRank > 0);
                const matches = a.title.toLowerCase().includes(query);
                return notInQueue && matches;
            });

            if (unqueued.length === 0) {
                this.autocompleteList.innerHTML = `<div class="queue-autocomplete-empty">Geen niet-toegevoegde series gevonden.</div>`;
            } else {
                this.autocompleteList.innerHTML = unqueued.slice(0, 15).map(a => `
                    <div class="queue-autocomplete-item" data-add-id="${a.id}">
                        <span>${a.title}</span>
                        <span style="color: var(--primary); font-weight: 700;">+ Toevoegen</span>
                    </div>
                `).join('');

                this.autocompleteList.querySelectorAll('[data-add-id]').forEach(el => {
                    el.addEventListener('click', () => {
                        const animeId = el.getAttribute('data-add-id');
                        this.repository.addToWatchQueue(animeId);
                        this.searchAddInput.value = '';
                        this.autocompleteList.classList.remove('visible');
                        this.render();
                        if (this.onUpdate) this.onUpdate();
                    });
                });
            }
            this.autocompleteList.classList.add('visible');
        });

        this.searchAddInput.addEventListener('focus', () => {
            if (this.searchAddInput.value.trim()) {
                this.autocompleteList.classList.add('visible');
            }
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.queue-add-section')) {
                this.autocompleteList.classList.remove('visible');
            }
        });
    }
}

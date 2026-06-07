import { AnimeRepository } from './domein/AnimeRepository.js';
import { DataStore } from './domein/DataStore.js';
import { CardRenderer } from './domein/CardRenderer.js';
import { AnilistApi } from './domein/AnilistApi.js';
import { SearchManager } from './domein/SearchManager.js';
import { ThemeManager } from './domein/ThemeManager.js';
import { CookieManager } from './domein/CookieManager.js';

// Overview page state. Persisted in cookies so the UI survives refreshes.
let repository = new AnimeRepository();
let currentFilter = normalizeStoredFilter(CookieManager.get('activeFilter') || 'all');
let currentSearchQuery = '';
let currentSort = CookieManager.get('sortOrder') || 'default';
let currentViewMode = CookieManager.get('viewMode') || 'grid';
let currentGridCols = CookieManager.get('gridCols') || '5';

/**
 * Normalizes legacy or missing filter values to prevent UI inconsistencies.
 * If the filter is unrecognized, it falls back to 'all'.
 * @param {string} filter - The filter value to normalize.
 * @returns {string} The normalized filter value.
 */
function normalizeStoredFilter(filter) {
    const validFilters = ['all', 'airing', 'upcoming', '-1', '0', '1'];
    return validFilters.includes(filter) ? filter : 'all';
}

/**
 * Bootstraps the overview page.
 * Linked to: `index.html` and the `#anime-container` list.
 */
async function init() {
    ThemeManager.initTheme();
    const data = await DataStore.loadInitialData();
    const normalized = repository.loadAndNormalize(data);

    if (currentFilter !== (CookieManager.get('activeFilter') || 'all')) {
        CookieManager.set('activeFilter', currentFilter);
    }
    if (normalized) {
        await DataStore.save(repository);
    }

    renderData();
    setupFilters();
    setupSorting();
    setupViewToggles();
    setupDownloadBtn();
    ThemeManager.bindToggle('theme-toggle');
    setupSearch();
    setupRatingModal();

    hydrateAnilistData();
}

/**
 * Fetches missing cover art and episode counts from AniList using rate-limit throttling and batch saving.
 * Linked to: AniList GraphQL and `CardRenderer.updateCardImage`.
 */
async function hydrateAnilistData() {
    const missing = repository.getAll().filter(a => !a.coverImage);
    const BATCH_SIZE = 5;
    let modified = false;

    for (let i = 0; i < missing.length; i += BATCH_SIZE) {
        const batch = missing.slice(i, i + BATCH_SIZE);

        const promises = batch.map(async (anime) => {
            let apiData = null;
            if (anime.anilistId) {
                apiData = await AnilistApi.fetchMediaById(anime.anilistId);
            } else {
                const searchTerm = anime.items.length > 0 ? anime.items[0].title : anime.title;
                apiData = await AnilistApi.fetchMediaByTitle(searchTerm);
            }

            if (apiData) {
                anime.coverImage = apiData.coverImage.large;
                if (anime.items.length > 0 && (anime.items[0].episodesCount === 0 || !anime.items[0].episodesCount)) {
                    anime.items[0].episodesCount = apiData.episodes || 0;
                }
                CardRenderer.updateCardImage(anime);
                modified = true;
            }
        });

        await Promise.all(promises);

        if (i + BATCH_SIZE < missing.length) {
            await new Promise(r => setTimeout(r, 1500));
        }
    }

    if (modified) {
        await DataStore.save(repository);
    }
}

// Active anime in the shared rating modal.
let currentRatingAnime = null;

/**
 * Opens the rating modal for the selected anime.
 * Linked to: `#modal-overlay`, `#modal-title`, and `#rating-number`.
 * @param {Anime} anime - The anime object to rate.
 */
function openRatingModal(anime) {
    currentRatingAnime = anime;
    const overlay = document.getElementById('modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const ratingInput = document.getElementById('rating-number');

    if (overlay && modalTitle && ratingInput) {
        modalTitle.textContent = anime.title;
        ratingInput.value = anime.rating > 0 ? anime.rating : "";
        overlay.classList.remove('hidden');
    }
}

/**
 * Sets up rating modal events dynamically, removing dependency on global window objects.
 * This binds click events to the save, clear, and cancel buttons.
 */
function setupRatingModal() {
    const overlay = document.getElementById('modal-overlay');
    if (!overlay) return;

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.classList.add('hidden');
            currentRatingAnime = null;
        }
    });

    const cancelBtn = document.getElementById('cancel-rating');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            overlay.classList.add('hidden');
            currentRatingAnime = null;
        });
    }

    const clearBtn = document.getElementById('clear-rating');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            const ratingInput = document.getElementById('rating-number');
            if (ratingInput) ratingInput.value = '';
        });
    }

    const saveBtn = document.getElementById('save-rating');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            if (currentRatingAnime) {
                import('./domein/RatingManager.js').then(async (module) => {
                    const ratingInput = document.getElementById('rating-number');
                    let val = ratingInput ? parseFloat(ratingInput.value) : 0;
                    if (isNaN(val)) val = 0;
                    if (val < 0) val = 0;
                    if (val > 10) val = 10;

                    module.RatingManager.updateRating(currentRatingAnime, val);
                    await DataStore.save(repository);
                    renderData();
                    overlay.classList.add('hidden');
                    currentRatingAnime = null;
                }).catch(err => {
                    console.error(err);
                    overlay.classList.add('hidden');
                    currentRatingAnime = null;
                });
            } else {
                overlay.classList.add('hidden');
            }
        });
    }
}

/**
 * Applies the current filter, search, and sort state, then renders cards.
 */
function renderData() {
    const container = document.getElementById('anime-container');
    let animes = repository.filterByStatus(currentFilter);

    animes = AnimeRepository.filterByQuery(animes, currentSearchQuery);
    animes = AnimeRepository.sort(animes, currentSort);

    document.getElementById('item-count').textContent = `${animes.length} items`;

    CardRenderer.renderAll(container, animes, openRatingModal);
}

/**
 * Binds the sort dropdown in the toolbar.
 */
function setupSorting() {
    const sortSelect = document.getElementById('sort-select');
    if (!sortSelect) return;

    sortSelect.value = currentSort;
    sortSelect.addEventListener('change', (e) => {
        currentSort = e.target.value;
        CookieManager.set('sortOrder', currentSort);
        renderData();
    });
}

/**
 * Binds the status filter buttons in the toolbar.
 */
function setupFilters() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        if (btn.getAttribute('data-filter') === currentFilter) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }

        btn.addEventListener('click', (e) => {
            filterBtns.forEach(b => b.classList.remove('active'));
            const target = e.currentTarget;
            target.classList.add('active');

            currentFilter = target.getAttribute('data-filter');
            CookieManager.set('activeFilter', currentFilter);
            renderData();
        });
    });
}

/**
 * Connects the search input to the query filter.
 */
function setupSearch() {
    SearchManager.setup('search-input', (query) => {
        currentSearchQuery = query;
        renderData();
    });
}

/**
 * Binds grid/list view toggles and grid-size buttons.
 */
function setupViewToggles() {
    const gridBtn = document.getElementById('grid-btn');
    const listBtn = document.getElementById('list-btn');
    const container = document.getElementById('anime-container');
    const sizeToggleContainer = document.getElementById('size-toggle-container');
    const minusBtn = document.getElementById('grid-cols-minus');
    const plusBtn = document.getElementById('grid-cols-plus');
    const colsVal = document.getElementById('grid-cols-val');

    // Initialize state
    colsVal.textContent = currentGridCols;
    container.style.setProperty('--grid-cols', currentGridCols);

    if (currentViewMode === 'list') {
        listBtn.classList.add('active');
        gridBtn.classList.remove('active');
        container.classList.remove('grid-view');
        container.classList.add('list-view');
        sizeToggleContainer.style.display = 'none';
    } else {
        gridBtn.classList.add('active');
        listBtn.classList.remove('active');
        container.classList.remove('grid-view');
        container.classList.add('grid-view');
        sizeToggleContainer.style.display = 'flex';
    }

    gridBtn.addEventListener('click', () => {
        currentViewMode = 'grid';
        CookieManager.set('viewMode', 'grid');

        gridBtn.classList.add('active');
        listBtn.classList.remove('active');
        container.classList.remove('list-view');
        container.classList.add('grid-view');
        container.style.setProperty('--grid-cols', currentGridCols);
        sizeToggleContainer.style.display = 'flex';
    });

    listBtn.addEventListener('click', () => {
        currentViewMode = 'list';
        CookieManager.set('viewMode', 'list');

        listBtn.classList.add('active');
        gridBtn.classList.remove('active');
        container.classList.remove('grid-view');
        container.classList.add('list-view');
        sizeToggleContainer.style.display = 'none';
    });

    /**
     * Updates the CSS custom property for grid columns and persists the value.
     * @param {number} newVal - The new grid column count.
     */
    function updateGridCols(newVal) {
        if (newVal < 2) newVal = 2;
        if (newVal > 8) newVal = 8;
        colsVal.textContent = newVal;
        container.style.setProperty('--grid-cols', newVal);
        currentGridCols = newVal.toString();
        CookieManager.set('gridCols', currentGridCols);
    }

    minusBtn.addEventListener('click', () => {
        updateGridCols(parseInt(currentGridCols) - 1);
    });
    
    plusBtn.addEventListener('click', () => {
        updateGridCols(parseInt(currentGridCols) + 1);
    });
}

/**
 * Reveals the download button and binds it to a JSON export.
 */
function setupDownloadBtn() {
    const dBtn = document.getElementById('download-btn');
    if (dBtn) {
        dBtn.classList.remove('hidden');
        dBtn.addEventListener('click', () => {
            DataStore.triggerBackup(repository);
        });
    }
}

document.addEventListener('DOMContentLoaded', init);

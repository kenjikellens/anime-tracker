import { AnimeRepository } from './domein/AnimeRepository.js';
import { DataStore } from './domein/DataStore.js';
import { CardRenderer } from './domein/CardRenderer.js';
import { AnilistApi } from './domein/AnilistApi.js';
import { SearchManager } from './domein/SearchManager.js';
import { ThemeManager } from './domein/ThemeManager.js';
import { StatusUpdater } from './domein/StatusUpdater.js';

// Overview page state. Persisted in localStorage so the UI survives refreshes.
let repository = new AnimeRepository();
let currentFilter = normalizeStoredFilter(localStorage.getItem('activeFilter') || 'all');
let currentSearchQuery = '';
let currentSort = localStorage.getItem('sortOrder') || 'default';
let currentViewMode = localStorage.getItem('viewMode') || 'grid';
let currentGridCols = localStorage.getItem('gridCols') || '5';

function normalizeStoredFilter(filter) {
    return filter === '2' ? '-1' : filter;
}

/**
 * Bootstraps the overview page.
 * Linked to: `index.html` and the `#anime-container` list.
 */
async function init() {
    ThemeManager.initTheme();
    const data = await DataStore.loadInitialData();
    repository.loadFromData(data);
    let normalized = false;
    repository.getAll().forEach(anime => {
        normalized = StatusUpdater.normalizeAnimeStatuses(anime) || normalized;
    });

    if (currentFilter !== (localStorage.getItem('activeFilter') || 'all')) {
        localStorage.setItem('activeFilter', currentFilter);
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
 * Fetches missing cover art and episode counts from AniList.
 * Linked to: AniList GraphQL and `CardRenderer.updateCardImage`.
 */
async function hydrateAnilistData() {
    const missing = repository.getAll().filter(a => !a.coverImage);
    const BATCH_SIZE = 15;

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
            }
        });

        await Promise.all(promises);
        await DataStore.save(repository);

        if (i + BATCH_SIZE < missing.length) {
            await new Promise(r => setTimeout(r, 1000));
        }
    }
}

// Active anime in the shared rating modal.
let currentRatingAnime = null;

/**
 * Opens the rating modal for the selected anime.
 * Linked to: `#modal-overlay`, `#modal-title`, and `#rating-number`.
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
 * Saves the rating from the modal and refreshes the overview.
 * Linked to: the save button in `index.html`.
 */
window.saveGlobalRating = function() {
    const overlay = document.getElementById('modal-overlay');
    const ratingInput = document.getElementById('rating-number');

    if (currentRatingAnime) {
        import('./domein/RatingManager.js').then(async (module) => {
            let val = parseFloat(ratingInput.value);
            if (isNaN(val)) val = 0;
            if (val < 0) val = 0;
            if (val > 10) val = 10;

            module.RatingManager.updateRating(currentRatingAnime, val);
            await DataStore.save(repository);
            renderData();
            if (overlay) overlay.classList.add('hidden');
            currentRatingAnime = null;
        }).catch(err => {
            console.error(err);
            if (overlay) overlay.classList.add('hidden');
        });
    } else {
        if (overlay) overlay.classList.add('hidden');
    }
};

/**
 * Closes the rating modal when the overlay itself is clicked.
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
        localStorage.setItem('sortOrder', currentSort);
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
            localStorage.setItem('activeFilter', currentFilter);
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
        container.classList.remove('list-view');
        container.classList.add('grid-view');
        sizeToggleContainer.style.display = 'flex';
    }

    gridBtn.addEventListener('click', () => {
        currentViewMode = 'grid';
        localStorage.setItem('viewMode', 'grid');

        gridBtn.classList.add('active');
        listBtn.classList.remove('active');
        container.classList.remove('list-view');
        container.classList.add('grid-view');
        container.style.setProperty('--grid-cols', currentGridCols);
        sizeToggleContainer.style.display = 'flex';
    });

    listBtn.addEventListener('click', () => {
        currentViewMode = 'list';
        localStorage.setItem('viewMode', 'list');

        listBtn.classList.add('active');
        gridBtn.classList.remove('active');
        container.classList.remove('grid-view');
        container.classList.add('list-view');
        sizeToggleContainer.style.display = 'none';
    });

    function updateGridCols(newVal) {
        if (newVal < 2) newVal = 2;
        if (newVal > 8) newVal = 8;
        colsVal.textContent = newVal;
        container.style.setProperty('--grid-cols', newVal);
        currentGridCols = newVal.toString();
        localStorage.setItem('gridCols', currentGridCols);
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

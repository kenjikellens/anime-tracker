import { AnimeRepository } from './domein/AnimeRepository.js';
import { RatingManager } from './domein/RatingManager.js';
import { DataStore } from './domein/DataStore.js';
import { CardRenderer } from './domein/CardRenderer.js';
import { DetailRenderer } from './domein/DetailRenderer.js';
import { StatusUpdater } from './domein/StatusUpdater.js';
import { AnilistApi } from './domein/AnilistApi.js';
import { SearchManager } from './domein/SearchManager.js';
import { ThemeManager } from './domein/ThemeManager.js';
import { CookieManager } from './domein/CookieManager.js';
import { DropdownManager } from './domein/DropdownManager.js';
import { FilterManager } from './domein/FilterManager.js';
import { QueueManager } from './domein/QueueManager.js';
import { UI_CLASSES } from './domein/UIConstants.js';

// Overview page state. Persisted in cookies so the UI survives refreshes.
let repository = new AnimeRepository();
let currentFilter = normalizeStoredFilter(CookieManager.get('activeFilter') || 'all');
let currentSearchQuery = '';
let currentSort = CookieManager.get('sortOrder') || 'default';
let currentViewMode = CookieManager.get('viewMode') || 'grid';
let currentGridCols = CookieManager.get('gridCols') || '5';
let filterManagerInstance = null;
let queueManagerInstance = null;

// Detail page state.
let currentDetailAnime = null;
let currentRatingTarget = null;
let currentRatingType = null;

// Cached view templates.
let homeLayoutHtml = null;
let detailLayoutHtml = null;

/**
 * Normalizes legacy or missing filter values to prevent UI inconsistencies.
 * @param {string} filter - The filter value to normalize.
 * @returns {string} The normalized filter value.
 */
function normalizeStoredFilter(filter) {
    const validFilters = ['all', 'airing', 'upcoming', '-1', '0', '1', '4'];
    return validFilters.includes(filter) ? filter : 'all';
}

/**
 * Routes and handles rendering of views based on the window location hash.
 */
async function handleRoute() {
    const hash = window.location.hash || '#/';
    const appContainer = document.getElementById('app');
    if (!appContainer) return;

    if (hash === '#/' || hash === '') {
        if (!document.getElementById('anime-container')) {
            if (!homeLayoutHtml) {
                const response = await fetch('home.html');
                homeLayoutHtml = await response.text();
            }
            appContainer.innerHTML = homeLayoutHtml;
            setupFilters();
            setupSorting();
            setupViewToggles();
            DropdownManager.bindAll(appContainer);
        }

        renderData();
    } else if (hash.startsWith('#/anime/')) {
        const id = hash.replace('#/anime/', '');
        currentDetailAnime = repository.getById(id);

        if (currentDetailAnime) {
            if (!detailLayoutHtml) {
                const response = await fetch('card.html');
                detailLayoutHtml = await response.text();
            }
            appContainer.innerHTML = detailLayoutHtml;

            renderDetail();

            // Fetch missing poster/episode data for this one record only.
            let needSave = false;
            if (currentDetailAnime.items.some(i => !i.episodesCount || i.episodesCount === 0)) {
                const searchTerm = currentDetailAnime.items.length > 0 ? currentDetailAnime.items[0].title : currentDetailAnime.title;
                const apiData = await AnilistApi.fetchMediaByTitle(searchTerm);
                if (currentDetailAnime?.id !== id) return;
                if (apiData) {
                    if (apiData.coverImage?.large) {
                        currentDetailAnime.coverImage = apiData.coverImage.large;
                    }

                    if (currentDetailAnime.items.length > 0 && (!currentDetailAnime.items[0].episodesCount || currentDetailAnime.items[0].episodesCount === 0)) {
                        currentDetailAnime.items[0].episodesCount = apiData.episodes || 12;
                    }
                    needSave = true;
                }
            }

            if (needSave) {
                await DataStore.save(repository);
                renderDetail();
            }
        } else {
            appContainer.innerHTML = '<p class="text-muted" data-empty="true">Anime niet gevonden.</p>';
        }
    }
}

/**
 * Bootstraps the Single Page Application.
 * Binds global header/footer listeners and runs the initial router match.
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

    setupRatingModal();
    setupDownloadBtn();
    setupSearch();
    setupBackToTop();
    setupFooterFilters();
    filterManagerInstance = FilterManager.setup(repository, () => {
        renderData();
    });
    queueManagerInstance = QueueManager.setup(repository, async () => {
        await DataStore.save(repository);
        renderData();
        if (window.location.hash.startsWith('#/anime/')) {
            renderDetail();
        }
    });
    ThemeManager.bindToggle('theme-toggle');
    await ThemeManager.initThemePicker('theme-picker-btn', 'theme-picker-menu');

    window.addEventListener('hashchange', handleRoute);
    await handleRoute();

    hydrateAnilistData();
}

/**
 * Connects footer status filter links so they work cleanly from any route.
 */
function setupFooterFilters() {
    document.querySelectorAll('[data-footer-filter]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const filterVal = link.getAttribute('data-footer-filter');
            currentFilter = normalizeStoredFilter(filterVal);
            CookieManager.set('activeFilter', currentFilter);

            if (window.location.hash === '#/' || window.location.hash === '') {
                const targetBtn = document.querySelector(`.filter-btn[data-filter="${currentFilter}"]`);
                if (targetBtn) {
                    targetBtn.click();
                } else {
                    renderData();
                }
            } else {
                window.location.hash = '#/';
            }

            const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
        });
    });
}

/**
 * Sets up the floating back to top button with scroll tracking and reduced-motion support.
 */
function setupBackToTop() {
    const btn = document.getElementById('back-to-top');
    if (!btn) return;

    const handleScroll = () => {
        const scrollPos = window.scrollY || document.documentElement.scrollTop || 0;
        const isScrolled = scrollPos > 150;
        btn.classList.toggle('visible', isScrolled);
        btn.dataset.visible = isScrolled ? 'true' : 'false';
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    btn.addEventListener('click', (e) => {
        e.preventDefault();
        const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    });
}

/**
 * Fetches missing cover art and episode counts from AniList using rate-limit throttling and batch saving.
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
                const itemTitle = anime.items.length > 0 ? anime.items[0].title : null;
                if (itemTitle) {
                    apiData = await AnilistApi.fetchMediaByTitle(itemTitle);
                }
                if (!apiData) {
                    apiData = await AnilistApi.fetchMediaByTitle(anime.title);
                }
            }

            if (apiData) {
                if (apiData.coverImage?.large) {
                    anime.coverImage = apiData.coverImage.large;
                }
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

let lastRatingFocusEl = null;

/**
 * Opens the shared rating modal for a specific target (anime or item).
 * @param {Object} target - The anime or item model to rate.
 * @param {string} type - The type of rating target ('anime' or 'item').
 */
function openRatingModal(target, type = 'anime') {
    const overlay = document.getElementById('modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const ratingInput = document.getElementById('rating-number');

    if (overlay && modalTitle && ratingInput) {
        lastRatingFocusEl = document.activeElement;
        currentRatingTarget = target;
        currentRatingType = type;
        modalTitle.textContent = target.title;
        ratingInput.value = target.rating > 0 ? target.rating : '';
        overlay.dataset.visible = 'true';
        overlay.classList.remove('hidden');
        ratingInput.focus();
        ratingInput.select();
    }
}

function openGlobalRatingModal() {
    if (currentDetailAnime) {
        openRatingModal(currentDetailAnime, 'anime');
    }
}

function openItemRatingModal(item) {
    openRatingModal(item, 'item');
}

/**
 * Sets up rating modal events including Escape-to-close and focus restoration.
 */
function setupRatingModal() {
    const overlay = document.getElementById('modal-overlay');
    if (!overlay) return;

    const closeRatingModal = () => {
        overlay.dataset.visible = 'false';
        overlay.classList.add('hidden');
        currentRatingTarget = null;
        currentRatingType = null;
        if (lastRatingFocusEl && typeof lastRatingFocusEl.focus === 'function') {
            lastRatingFocusEl.focus();
        }
    };

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeRatingModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay.dataset.visible === 'true') {
            closeRatingModal();
        }
    });

    const cancelBtn = document.getElementById('cancel-rating');
    if (cancelBtn) cancelBtn.addEventListener('click', closeRatingModal);

    const clearBtn = document.getElementById('clear-rating');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            const ratingInput = document.getElementById('rating-number');
            if (ratingInput) {
                ratingInput.value = '';
                ratingInput.focus();
            }
        });
    }

    const saveBtn = document.getElementById('save-rating');
    const ratingInput = document.getElementById('rating-number');
    if (ratingInput && saveBtn) {
        ratingInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveBtn.click();
            }
        });
    }
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const ratingInput = document.getElementById('rating-number');
            if (currentRatingTarget && ratingInput) {
                try {
                    let val = parseFloat(ratingInput.value);
                    if (isNaN(val)) val = 0;
                    if (val < 0) val = 0;
                    if (val > 10) val = 10;

                    if (currentRatingType === 'anime') {
                        RatingManager.updateRating(currentRatingTarget, val);
                    } else if (currentRatingType === 'item') {
                        RatingManager.updateItemRating(currentRatingTarget, val);
                    }

                    await DataStore.save(repository);

                    if (window.location.hash.startsWith('#/anime/')) {
                        renderDetail();
                    } else {
                        renderData();
                    }

                    closeRatingModal();
                } catch (err) {
                    console.error(err);
                    closeRatingModal();
                }
            } else {
                closeRatingModal();
            }
        });
    }
}

let cardObserver = null;
let currentRenderIndex = 0;
let allFilteredAnimes = [];
const RENDER_BATCH_SIZE = 12;

/**
 * Handles toggling an anime's membership in the Top Watch Queue.
 * @param {Anime} anime - The anime model to toggle.
 */
async function handleQueueToggle(anime) {
    if (typeof anime.watchRank === 'number' && anime.watchRank > 0) {
        repository.removeFromWatchQueue(anime.id);
    } else {
        repository.addToWatchQueue(anime.id);
    }
    await DataStore.save(repository);
    if (queueManagerInstance) {
        queueManagerInstance.render();
    }
    renderData();
    if (window.location.hash.startsWith('#/anime/')) {
        renderDetail();
    }
}

/**
 * Loads and appends the next batch of anime cards to the container.
 * @param {boolean} [isFirst=false] - Whether this is the first batch to load.
 */
function loadNextBatch(isFirst = false) {
    const container = document.getElementById('anime-container');
    if (!container) return;

    const nextBatch = allFilteredAnimes.slice(currentRenderIndex, currentRenderIndex + RENDER_BATCH_SIZE);

    if (nextBatch.length > 0) {
        CardRenderer.renderBatch(container, nextBatch, (anime) => openRatingModal(anime, 'anime'), isFirst, handleQueueToggle);
        currentRenderIndex += nextBatch.length;
    }

    if (currentRenderIndex >= allFilteredAnimes.length) {
        if (cardObserver) {
            cardObserver.disconnect();
            cardObserver = null;
        }
        const sentinel = document.getElementById('sentinel');
        if (sentinel) {
            sentinel.remove();
        }
    }
}

/**
 * Applies the current filter, search, and sort state, then renders cards.
 */
function renderData() {
    const container = document.getElementById('anime-container');
    if (!container) return;

    if (cardObserver) {
        cardObserver.disconnect();
        cardObserver = null;
    }

    let animes = repository.filterByStatus(currentFilter);
    const activeFilterOptions = FilterManager.loadOptions();
    animes = AnimeRepository.filterByAdvancedOptions(animes, activeFilterOptions);
    animes = AnimeRepository.filterByQuery(animes, currentSearchQuery);
    animes = AnimeRepository.sort(animes, currentSort);

    allFilteredAnimes = animes;
    currentRenderIndex = 0;

    const itemCountEl = document.getElementById('item-count');
    if (itemCountEl) {
        itemCountEl.textContent = `${animes.length} items`;
    }

    if (filterManagerInstance) {
        filterManagerInstance.updateBadge();
    }

    const genLoader = document.getElementById('general-app-loader');
    if (genLoader) {
        genLoader.dataset.visible = 'false';
    }

    loadNextBatch(true);

    if (currentRenderIndex < allFilteredAnimes.length) {
        let sentinel = document.getElementById('sentinel');
        if (!sentinel) {
            sentinel = document.createElement('div');
            sentinel.id = 'sentinel';
            sentinel.dataset.sentinel = 'true';
        }
        container.appendChild(sentinel);

        cardObserver = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                loadNextBatch();
            }
        }, {
            rootMargin: '200px'
        });
        cardObserver.observe(sentinel);
    }
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
    const filterBtns = document.querySelectorAll('.filter-btn[data-filter]');
    filterBtns.forEach(btn => {
        const isActive = btn.getAttribute('data-filter') === currentFilter;
        btn.dataset.active = isActive ? 'true' : 'false';
        btn.classList.toggle(UI_CLASSES.ACTIVE, isActive);

        btn.addEventListener('click', (e) => {
            filterBtns.forEach(b => {
                b.dataset.active = 'false';
                b.classList.remove(UI_CLASSES.ACTIVE);
            });
            const target = e.currentTarget;
            target.dataset.active = 'true';
            target.classList.add(UI_CLASSES.ACTIVE);

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
        if (window.location.hash === '#/' || window.location.hash === '') {
            renderData();
        } else {
            window.location.hash = '#/';
        }
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

    if (!container) return;

    if (colsVal) colsVal.textContent = currentGridCols;
    container.style.setProperty('--grid-cols', currentGridCols);

    function applyViewMode(mode) {
        const isGrid = mode === 'grid';
        if (gridBtn) {
            gridBtn.dataset.active = isGrid ? 'true' : 'false';
            gridBtn.classList.toggle(UI_CLASSES.ACTIVE, isGrid);
            gridBtn.setAttribute('aria-pressed', isGrid ? 'true' : 'false');
        }
        if (listBtn) {
            listBtn.dataset.active = isGrid ? 'false' : 'true';
            listBtn.classList.toggle(UI_CLASSES.ACTIVE, !isGrid);
            listBtn.setAttribute('aria-pressed', !isGrid ? 'true' : 'false');
        }
        container.dataset.view = mode;
        container.classList.toggle(UI_CLASSES.GRID_VIEW, isGrid);
        container.classList.toggle(UI_CLASSES.LIST_VIEW, !isGrid);
        if (sizeToggleContainer) sizeToggleContainer.dataset.visible = isGrid ? 'true' : 'false';
    }

    applyViewMode(currentViewMode);

    if (gridBtn) {
        gridBtn.addEventListener('click', () => {
            currentViewMode = 'grid';
            CookieManager.set('viewMode', 'grid');
            applyViewMode('grid');
            container.style.setProperty('--grid-cols', currentGridCols);
            renderData();
        });
    }

    if (listBtn) {
        listBtn.addEventListener('click', () => {
            currentViewMode = 'list';
            CookieManager.set('viewMode', 'list');
            applyViewMode('list');
            renderData();
        });
    }

    function updateGridCols(newVal) {
        if (newVal < 2) newVal = 2;
        if (newVal > 8) newVal = 8;
        if (colsVal) colsVal.textContent = newVal;
        container.style.setProperty('--grid-cols', newVal);
        currentGridCols = newVal.toString();
        CookieManager.set('gridCols', currentGridCols);
    }

    if (minusBtn) {
        minusBtn.addEventListener('click', () => {
            updateGridCols(parseInt(currentGridCols, 10) - 1);
        });
    }

    if (plusBtn) {
        plusBtn.addEventListener('click', () => {
            updateGridCols(parseInt(currentGridCols, 10) + 1);
        });
    }
}

/**
 * Reveals the download button and binds it to a JSON export.
 */
function setupDownloadBtn() {
    const dBtn = document.getElementById('download-btn');
    if (dBtn) {
        dBtn.dataset.visible = 'true';
        dBtn.classList.remove(UI_CLASSES.HIDDEN);
        dBtn.addEventListener('click', () => {
            DataStore.triggerBackup(repository);
        });
    }
}

/**
 * Renders the detail page content and accordion elements using the static DetailRenderer.
 * Updates `#detail-container` synchronously to avoid async import race conditions.
 */
function renderDetail() {
    const container = document.getElementById('detail-container');
    if (!container || !currentDetailAnime) return;

    const openItemIds = Array.from(container.querySelectorAll('.item-accordion-wrapper[open]'))
        .map(wrapper => wrapper.getAttribute('data-item-id'));

    DetailRenderer.renderDetail(
        container,
        currentDetailAnime,
        handleItemStatus,
        handleGlobalStatus,
        null,
        handleEpisodeToggle,
        openGlobalRatingModal,
        openItemIds,
        openItemRatingModal,
        null,
        handleQueueToggle,
        handleTimesWatchedChange
    );
}

/**
 * Persists changes after the user updates the rewatch counter on the detail page.
 */
async function handleTimesWatchedChange() {
    await DataStore.save(repository);
}

/**
 * Applies a StatusUpdater mutation, persists the repository, and re-renders the detail view.
 * Mutates repository state, localStorage/backend persistence, and `#detail-container`.
 */
async function withStatusUpdater(fn) {
    fn(StatusUpdater);
    await DataStore.save(repository);
    renderDetail();
}

function handleEpisodeToggle(item, episodeNum) {
    if (currentDetailAnime) {
        withStatusUpdater(s => s.toggleEpisode(item, episodeNum, currentDetailAnime));
    }
}

function handleItemStatus(item, newStatus) {
    if (currentDetailAnime) {
        withStatusUpdater(s => s.updateItemStatus(item, newStatus, currentDetailAnime));
    }
}

function handleGlobalStatus(anime, newStatus) {
    withStatusUpdater(s => s.updateGlobalStatus(anime, newStatus));
}

document.addEventListener('DOMContentLoaded', init);

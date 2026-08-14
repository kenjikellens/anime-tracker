import { AnimeRepository } from './domein/AnimeRepository.js';
import { RatingManager } from './domein/RatingManager.js';
import { DataStore } from './domein/DataStore.js';
import { CardRenderer } from './domein/CardRenderer.js';
import { AnilistApi } from './domein/AnilistApi.js';
import { SearchManager } from './domein/SearchManager.js';
import { ThemeManager } from './domein/ThemeManager.js';
import { CookieManager } from './domein/CookieManager.js';
import { DropdownManager } from './domein/DropdownManager.js';
import { FilterManager } from './domein/FilterManager.js';
import { UI_CLASSES } from './domein/UIConstants.js';

// Overview page state. Persisted in cookies so the UI survives refreshes.
let repository = new AnimeRepository();
let currentFilter = normalizeStoredFilter(CookieManager.get('activeFilter') || 'all');
let currentSearchQuery = '';
let currentSort = CookieManager.get('sortOrder') || 'default';
let currentViewMode = CookieManager.get('viewMode') || 'grid';
let currentGridCols = CookieManager.get('gridCols') || '5';
let filterManagerInstance = null;

// Detail page state.
let currentDetailAnime = null;
let currentRatingTarget = null;
let currentRatingType = null;

/**
 * Normalizes legacy or missing filter values to prevent UI inconsistencies.
 * If the filter is unrecognized, it falls back to 'all'.
 * @param {string} filter - The filter value to normalize.
 * @returns {string} The normalized filter value.
 */
function normalizeStoredFilter(filter) {
    const validFilters = ['all', 'airing', 'upcoming', '-1', '0', '1', '4'];
    return validFilters.includes(filter) ? filter : 'all';
}

/**
 * Routes and handles rendering of views based on the window location hash.
 * Fetches dynamic templates for home.html or card.html and renders the layout.
 */
let homeLayoutHtml = null;

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
        }

        renderData();
        setupFilters();
        setupSorting();
        setupViewToggles();
        DropdownManager.bindAll(appContainer);
    } else if (hash.startsWith('#/anime/')) {
        const id = hash.replace('#/anime/', '');
        currentDetailAnime = repository.getById(id);

        if (currentDetailAnime) {
            const cardLoadStartTime = Date.now();
            const response = await fetch('card.html');
            appContainer.innerHTML = await response.text();

            renderDetail(cardLoadStartTime);
            DropdownManager.bindAll(appContainer);

            // Fetch missing poster/episode data for this one record only.
            let needSave = false;
            if (currentDetailAnime.items.some(i => !i.episodesCount || i.episodesCount === 0)) {
                const searchTerm = currentDetailAnime.items.length > 0 ? currentDetailAnime.items[0].title : currentDetailAnime.title;
                const apiData = await AnilistApi.fetchMediaByTitle(searchTerm);
                if (apiData) {
                    currentDetailAnime.coverImage = apiData.coverImage.large;

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
    filterManagerInstance = FilterManager.setup(repository, () => {
        renderData();
    });
    ThemeManager.bindToggle('theme-toggle');

    window.addEventListener('hashchange', handleRoute);
    await handleRoute();

    hydrateAnilistData();
}

/**
 * Sets up the floating back to top button with scroll tracking and smooth scroll.
 */
function setupBackToTop() {
    const btn = document.getElementById('back-to-top');
    if (!btn) return;

    const handleScroll = () => {
        const scrollPos = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
        const isScrolled = scrollPos > 150;
        btn.classList.toggle('visible', isScrolled);
        btn.dataset.visible = isScrolled ? 'true' : 'false';
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    btn.addEventListener('click', (e) => {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
    });
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
                const itemTitle = anime.items.length > 0 ? anime.items[0].title : null;
                if (itemTitle) {
                    apiData = await AnilistApi.fetchMediaByTitle(itemTitle);
                }
                if (!apiData) {
                    apiData = await AnilistApi.fetchMediaByTitle(anime.title);
                }
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
        currentRatingTarget = target;
        currentRatingType = type;
        modalTitle.textContent = target.title;
        ratingInput.value = target.rating > 0 ? target.rating : "";
        overlay.dataset.visible = 'true';
        overlay.classList.remove('hidden');
    }
}

/**
 * Opens the shared rating modal for the global/current detail anime.
 */
function openGlobalRatingModal() {
    if (currentDetailAnime) {
        openRatingModal(currentDetailAnime, 'anime');
    }
}

/**
 * Opens the shared rating modal for a specific detail item.
 * @param {Object} item - The detail item model to rate.
 */
function openItemRatingModal(item) {
    openRatingModal(item, 'item');
}

/**
 * Sets up rating modal events dynamically, removing dependency on global window objects.
 * This binds click events to the save, clear, and cancel buttons.
 */
function setupRatingModal() {
    const overlay = document.getElementById('modal-overlay');
    if (!overlay) return;

    const closeRatingModal = () => {
        overlay.dataset.visible = 'false';
        overlay.classList.add('hidden');
        currentRatingTarget = null;
        currentRatingType = null;
    };

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeRatingModal();
    });

    const cancelBtn = document.getElementById('cancel-rating');
    if (cancelBtn) cancelBtn.addEventListener('click', closeRatingModal);

    const clearBtn = document.getElementById('clear-rating');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            const ratingInput = document.getElementById('rating-number');
            if (ratingInput) ratingInput.value = '';
        });
    }

    const saveBtn = document.getElementById('save-rating');
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
 * Loads and appends the next batch of anime cards to the container.
 * This affects the `#anime-container` DOM element by adding card components.
 * @param {boolean} [isFirst=false] - Whether this is the first batch to load.
 */
function loadNextBatch(isFirst = false) {
    const container = document.getElementById('anime-container');
    if (!container) return;

    const nextBatch = allFilteredAnimes.slice(currentRenderIndex, currentRenderIndex + RENDER_BATCH_SIZE);
    
    if (nextBatch.length > 0) {
        CardRenderer.renderBatch(container, nextBatch, (anime) => openRatingModal(anime, 'anime'), isFirst);
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
 * This resets the lazy loading pagination state and sets up a new IntersectionObserver.
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
        if (isActive) {
            btn.classList.add(UI_CLASSES.ACTIVE);
        } else {
            btn.classList.remove(UI_CLASSES.ACTIVE);
        }

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
            // Redirect to home and search if we search from detail page
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

    colsVal.textContent = currentGridCols;
    container.style.setProperty('--grid-cols', currentGridCols);

    function applyViewMode(mode) {
        const isGrid = mode === 'grid';
        if (gridBtn) {
            gridBtn.dataset.active = isGrid ? 'true' : 'false';
            gridBtn.classList.toggle(UI_CLASSES.ACTIVE, isGrid);
        }
        if (listBtn) {
            listBtn.dataset.active = isGrid ? 'false' : 'true';
            listBtn.classList.toggle(UI_CLASSES.ACTIVE, !isGrid);
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
            updateGridCols(parseInt(currentGridCols) - 1);
        });
    }
    
    if (plusBtn) {
        plusBtn.addEventListener('click', () => {
            updateGridCols(parseInt(currentGridCols) + 1);
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
 * Renders the detail page content and accordion elements.
 * @param {number|null} [loadStartTime=null] - Optional start timestamp to enforce minimum loader duration.
 */
function renderDetail(loadStartTime = null) {
    const container = document.getElementById('detail-container');
    if (!container || !currentDetailAnime) return;
    
    const openItemIds = Array.from(container.querySelectorAll('.item-accordion-wrapper[open]'))
        .map(wrapper => wrapper.getAttribute('data-item-id'));

    import('./domein/DetailRenderer.js').then(module => {
        module.DetailRenderer.renderDetail(
            container,
            currentDetailAnime,
            handleItemStatus,
            handleGlobalStatus,
            null,
            handleEpisodeToggle,
            openGlobalRatingModal,
            openItemIds,
            openItemRatingModal,
            loadStartTime
        );
    });
}

async function withStatusUpdater(fn) {
    const { StatusUpdater } = await import('./domein/StatusUpdater.js');
    fn(StatusUpdater);
    await DataStore.save(repository);
    renderDetail();
}

/**
 * Toggles an episode check status for a specific detail item.
 * @param {Object} item - The detail item model.
 * @param {number} episodeNum - The episode number.
 */
function handleEpisodeToggle(item, episodeNum) {
    if (currentDetailAnime) {
        withStatusUpdater(s => s.toggleEpisode(item, episodeNum, currentDetailAnime));
    }
}

/**
 * Updates status of a detail item (e.g., season or movie).
 * @param {Object} item - The detail item model.
 * @param {string} newStatus - The new status value.
 */
function handleItemStatus(item, newStatus) {
    if (currentDetailAnime) {
        withStatusUpdater(s => s.updateItemStatus(item, newStatus, currentDetailAnime));
    }
}

/**
 * Updates global status of the anime franchise.
 * @param {Object} anime - The parent anime model.
 * @param {string} newStatus - The new status value.
 */
function handleGlobalStatus(anime, newStatus) {
    withStatusUpdater(s => s.updateGlobalStatus(anime, newStatus));
}

document.addEventListener('DOMContentLoaded', init);

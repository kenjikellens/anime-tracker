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
    const validFilters = ['all', 'airing', 'upcoming', '-1', '0', '1'];
    return validFilters.includes(filter) ? filter : 'all';
}

let loadingInterval = null;
let currentProgress = 0;

/**
 * Starts the circular progress loader animation on the splash screen.
 * @param {boolean} [showSpinner=true] - Whether to show the spinner.
 * @param {number} [transitionDuration=0.6] - Transition duration in seconds.
 * @returns {Promise<void>} Resolves when the splash screen fade-in completes.
 */
function startLoader(showSpinner = true, transitionDuration = 0.6) {
    const splash = document.getElementById('splash-screen');
    const circle = splash?.querySelector('.loader-progress-circle');
    const loaderSvg = splash?.querySelector('.circular-loader-svg');
    if (!splash || !circle) return Promise.resolve();

    clearInterval(loadingInterval);
    currentProgress = 0;
    
    if (loaderSvg) {
        loaderSvg.style.display = showSpinner ? 'block' : 'none';
    }
    
    splash.style.transition = `opacity ${transitionDuration}s ease, visibility ${transitionDuration}s ease`;
    splash.classList.remove('hidden');
    circle.style.strokeDashoffset = '314.16';

    if (showSpinner) {
        const stepMs = 50;
        const totalMs = 4000;
        const progressPerStep = (stepMs / totalMs) * 100;

        loadingInterval = setInterval(() => {
            if (currentProgress < 99) {
                currentProgress += progressPerStep;
                if (currentProgress > 99) currentProgress = 99;
                
                const offset = 314.16 * (1 - currentProgress / 100);
                circle.style.strokeDashoffset = offset;
            }
        }, stepMs);
    }

    return new Promise(resolve => setTimeout(resolve, 700));
}

/**
 * Rapidly completes the circular loader progress to 100% and hides the splash screen.
 * @param {number} [transitionDuration=0.6] - Transition duration in seconds.
 */
function finishLoader(transitionDuration = 0.6) {
    const splash = document.getElementById('splash-screen');
    const circle = splash?.querySelector('.loader-progress-circle');
    if (!splash || !circle) return;

    clearInterval(loadingInterval);

    const startVal = currentProgress;
    const targetVal = 100;
    const duration = currentProgress > 0 ? 500 : 0;
    const startTime = performance.now();

    splash.style.transition = `opacity ${transitionDuration}s ease, visibility ${transitionDuration}s ease`;

    function animate(now) {
        const elapsed = now - startTime;
        const progress = duration > 0 ? Math.min(elapsed / duration, 1) : 1;
        const current = startVal + (targetVal - startVal) * progress;

        const offset = 314.16 * (1 - current / 100);
        circle.style.strokeDashoffset = offset;

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            setTimeout(() => {
                splash.classList.add('hidden');
            }, 100);
        }
    }

    requestAnimationFrame(animate);
}

/**
 * Routes and handles rendering of views based on the window location hash.
 * Fetches dynamic templates for home.html or card.html and renders the layout.
 */
async function handleRoute() {
    const hash = window.location.hash || '#/';
    const appContainer = document.getElementById('app');
    if (!appContainer) return;

    if (hash === '#/' || hash === '') {
        await startLoader(false, 0.2);
        const response = await fetch('home.html');
        appContainer.innerHTML = await response.text();

        renderData();
        setupFilters();
        setupSorting();
        setupViewToggles();
        finishLoader(0.2);
    } else if (hash.startsWith('#/anime/')) {
        await startLoader();
        const id = hash.replace('#/anime/', '');
        currentDetailAnime = repository.getById(id);

        if (currentDetailAnime) {
            const response = await fetch('card.html');
            appContainer.innerHTML = await response.text();

            renderDetail();

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
            finishLoader();
        } else {
            appContainer.innerHTML = '<p class="text-muted" style="padding: 20px;">Anime niet gevonden.</p>';
            finishLoader();
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
    ThemeManager.bindToggle('theme-toggle');

    window.addEventListener('hashchange', handleRoute);
    await handleRoute();

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

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.classList.add('hidden');
            currentRatingTarget = null;
            currentRatingType = null;
        }
    });

    const cancelBtn = document.getElementById('cancel-rating');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            overlay.classList.add('hidden');
            currentRatingTarget = null;
            currentRatingType = null;
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
            const ratingInput = document.getElementById('rating-number');
            if (currentRatingTarget && ratingInput) {
                import('./domein/RatingManager.js').then(async (module) => {
                    let val = parseFloat(ratingInput.value);
                    if (isNaN(val)) val = 0;
                    if (val < 0) val = 0;
                    if (val > 10) val = 10;

                    if (currentRatingType === 'anime') {
                        module.RatingManager.updateRating(currentRatingTarget, val);
                    } else if (currentRatingType === 'item') {
                        module.RatingManager.updateItemRating(currentRatingTarget, val);
                    }

                    await DataStore.save(repository);
                    
                    if (window.location.hash.startsWith('#/anime/')) {
                        renderDetail();
                    } else {
                        renderData();
                    }

                    overlay.classList.add('hidden');
                    currentRatingTarget = null;
                    currentRatingType = null;
                }).catch(err => {
                    console.error(err);
                    overlay.classList.add('hidden');
                    currentRatingTarget = null;
                    currentRatingType = null;
                });
            } else {
                overlay.classList.add('hidden');
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
    animes = AnimeRepository.filterByQuery(animes, currentSearchQuery);
    animes = AnimeRepository.sort(animes, currentSort);

    allFilteredAnimes = animes;
    currentRenderIndex = 0;

    const itemCountEl = document.getElementById('item-count');
    if (itemCountEl) {
        itemCountEl.textContent = `${animes.length} items`;
    }

    loadNextBatch(true);

    if (currentRenderIndex < allFilteredAnimes.length) {
        let sentinel = document.getElementById('sentinel');
        if (!sentinel) {
            sentinel = document.createElement('div');
            sentinel.id = 'sentinel';
            sentinel.style.height = '10px';
            sentinel.style.margin = '20px 0';
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

    if (currentViewMode === 'list') {
        if (listBtn) listBtn.classList.add('active');
        if (gridBtn) gridBtn.classList.remove('active');
        container.classList.remove('grid-view');
        container.classList.add('list-view');
        if (sizeToggleContainer) sizeToggleContainer.style.display = 'none';
    } else {
        if (gridBtn) gridBtn.classList.add('active');
        if (listBtn) listBtn.classList.remove('active');
        container.classList.remove('grid-view');
        container.classList.add('grid-view');
        if (sizeToggleContainer) sizeToggleContainer.style.display = 'flex';
    }

    if (gridBtn) {
        gridBtn.addEventListener('click', () => {
            currentViewMode = 'grid';
            CookieManager.set('viewMode', 'grid');

            gridBtn.classList.add('active');
            if (listBtn) listBtn.classList.remove('active');
            container.classList.remove('list-view');
            container.classList.add('grid-view');
            container.style.setProperty('--grid-cols', currentGridCols);
            if (sizeToggleContainer) sizeToggleContainer.style.display = 'flex';
            renderData();
        });
    }

    if (listBtn) {
        listBtn.addEventListener('click', () => {
            currentViewMode = 'list';
            CookieManager.set('viewMode', 'list');

            listBtn.classList.add('active');
            if (gridBtn) gridBtn.classList.remove('active');
            container.classList.remove('grid-view');
            container.classList.add('list-view');
            if (sizeToggleContainer) sizeToggleContainer.style.display = 'none';
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
        dBtn.classList.remove('hidden');
        dBtn.addEventListener('click', () => {
            DataStore.triggerBackup(repository);
        });
    }
}

/**
 * Renders the detail page content and accordion elements.
 */
function renderDetail() {
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
            openItemRatingModal
        );
    });
}

/**
 * Toggles an episode check status for a specific detail item.
 * @param {Object} item - The detail item model.
 * @param {number} episodeNum - The episode number.
 */
function handleEpisodeToggle(item, episodeNum) {
    if (currentDetailAnime) {
        import('./domein/StatusUpdater.js').then(module => {
            module.StatusUpdater.toggleEpisode(item, episodeNum, currentDetailAnime);
            DataStore.save(repository);
            renderDetail();
        });
    }
}

/**
 * Updates status of a detail item (e.g., season or movie).
 * @param {Object} item - The detail item model.
 * @param {string} newStatus - The new status value.
 */
function handleItemStatus(item, newStatus) {
    if (currentDetailAnime) {
        import('./domein/StatusUpdater.js').then(module => {
            module.StatusUpdater.updateItemStatus(item, newStatus, currentDetailAnime);
            DataStore.save(repository);
            renderDetail();
        });
    }
}

/**
 * Updates global status of the anime franchise.
 * @param {Object} anime - The parent anime model.
 * @param {string} newStatus - The new status value.
 */
function handleGlobalStatus(anime, newStatus) {
    import('./domein/StatusUpdater.js').then(module => {
        module.StatusUpdater.updateGlobalStatus(anime, newStatus);
        DataStore.save(repository);
        renderDetail();
    });
}

document.addEventListener('DOMContentLoaded', init);

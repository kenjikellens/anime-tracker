import { AnimeRepository } from './domein/AnimeRepository.js';
import { DataStore } from './domein/DataStore.js';
import { CardRenderer } from './domein/CardRenderer.js';
import { AnilistApi } from './domein/AnilistApi.js';
import { SearchManager } from './domein/SearchManager.js';

let repository = new AnimeRepository();
let currentFilter = 'all';
let currentSearchQuery = '';
let currentSort = localStorage.getItem('sortOrder') || 'default';
let currentViewMode = localStorage.getItem('viewMode') || 'grid';
let currentGridSize = localStorage.getItem('gridSize') || 'size-m';

async function init() {
    const data = await DataStore.loadInitialData();
    repository.loadFromData(data);
    
    // Initial Render
    renderData();
    
    // Setup UI
    setupFilters();
    setupSorting();
    setupViewToggles();
    setupDownloadBtn();
    setupThemeToggle();
    setupSearch();
    
    // Background Anilist Hydration
    hydrateAnilistData();
}

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
        await DataStore.save(repository); // save to cache after batch is loaded
        
        if (i + BATCH_SIZE < missing.length) {
            await new Promise(r => setTimeout(r, 1000)); // brief pause to protect API limit
        }
    }
}

let currentRatingAnime = null;

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

function setupRatingModal() {
    const overlay = document.getElementById('modal-overlay');
    if (!overlay) return;
    
    // Close on background click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.classList.add('hidden');
            currentRatingAnime = null;
        }
    });
}

function renderData() {
    const container = document.getElementById('anime-container');
    let animes = repository.filterByStatus(currentFilter);
    
    // Apply Search
    animes = AnimeRepository.filterByQuery(animes, currentSearchQuery);
    
    // Apply sorting
    animes = AnimeRepository.sort(animes, currentSort);
    
    document.getElementById('item-count').textContent = `${animes.length} items`;
    
    CardRenderer.renderAll(container, animes, openRatingModal);
}

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

function setupFilters() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            currentFilter = e.target.getAttribute('data-filter');
            renderData();
        });
    });
}

function setupSearch() {
    SearchManager.setup('search-input', (query) => {
        currentSearchQuery = query;
        renderData();
    });
}

function setupViewToggles() {
    const gridBtn = document.getElementById('grid-btn');
    const listBtn = document.getElementById('list-btn');
    const container = document.getElementById('anime-container');
    const sizeToggleContainer = document.getElementById('size-toggle-container');
    const sizeBtns = document.querySelectorAll('.size-btn');
    
    // Initialize from state
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
        container.classList.add(currentGridSize);
        sizeToggleContainer.style.display = 'flex';
    }

    // Set active size button
    sizeBtns.forEach(btn => {
        btn.classList.remove('active');
        if (`size-${btn.getAttribute('data-size')}` === currentGridSize) {
            btn.classList.add('active');
        }
    });
    
    gridBtn.addEventListener('click', () => {
        currentViewMode = 'grid';
        localStorage.setItem('viewMode', 'grid');
        
        gridBtn.classList.add('active');
        listBtn.classList.remove('active');
        container.classList.remove('list-view');
        container.classList.add('grid-view');
        container.classList.add(currentGridSize);
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
    
    sizeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (container.classList.contains('list-view')) return;
            
            sizeBtns.forEach(b => b.classList.remove('active'));
            const target = e.target;
            target.classList.add('active');
            
            const newSize = `size-${target.getAttribute('data-size')}`;
            ['size-s', 'size-m', 'size-l'].forEach(c => container.classList.remove(c));
            container.classList.add(newSize);
            
            currentGridSize = newSize;
            localStorage.setItem('gridSize', currentGridSize);
        });
    });
}

function setupDownloadBtn() {
    const dBtn = document.getElementById('download-btn');
    if (dBtn) {
        dBtn.classList.remove('hidden');
        dBtn.addEventListener('click', () => {
            DataStore.triggerBackup(repository);
        });
    }
}

function setupThemeToggle() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    
    // Load existing theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    
    btn.addEventListener('click', () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        if (isDark) {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('theme', 'light');
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
        }
    });
}

document.addEventListener('DOMContentLoaded', init);

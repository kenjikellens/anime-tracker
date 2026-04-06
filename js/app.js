import { AnimeRepository } from './domein/AnimeRepository.js';
import { DataStore } from './domein/DataStore.js';
import { CardRenderer } from './domein/CardRenderer.js';
import { AnilistApi } from './domein/AnilistApi.js';

let repository = new AnimeRepository();
let currentFilter = 'all';

async function init() {
    const data = await DataStore.loadInitialData();
    repository.loadFromData(data);
    
    // Initial Render
    renderData();
    
    // Setup UI
    setupFilters();
    setupViewToggles();
    setupDownloadBtn();
    setupThemeToggle();
    
    // Background Anilist Hydration
    hydrateAnilistData();
}

async function hydrateAnilistData() {
    const missing = repository.getAll().filter(a => !a.coverImage);
    const BATCH_SIZE = 15;
    
    for (let i = 0; i < missing.length; i += BATCH_SIZE) {
        const batch = missing.slice(i, i + BATCH_SIZE);
        
        const promises = batch.map(async (anime) => {
            const searchTerm = anime.items.length > 0 ? anime.items[0].title : anime.title;
            const apiData = await AnilistApi.fetchMediaByTitle(searchTerm);
            if (apiData) {
                anime.coverImage = apiData.coverImage.large;
                anime.format = apiData.format;
                if (anime.items.length > 0) {
                     anime.items[0].episodesCount = apiData.episodes || 0;
                }
                CardRenderer.updateCardImage(anime);
            }
        });
        
        await Promise.all(promises);
        DataStore.save(repository); // save to cache after batch is loaded
        
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
        import('./domein/RatingManager.js').then(module => {
            let val = parseFloat(ratingInput.value);
            if (isNaN(val)) val = 0;
            if (val < 0) val = 0;
            if (val > 10) val = 10;
            
            module.RatingManager.updateRating(currentRatingAnime, val);
            DataStore.save(repository);
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
    const animes = repository.filterByStatus(currentFilter);
    
    document.getElementById('item-count').textContent = `${animes.length} items`;
    
    CardRenderer.renderAll(container, animes, openRatingModal);
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

function setupViewToggles() {
    const gridBtn = document.getElementById('grid-btn');
    const listBtn = document.getElementById('list-btn');
    const container = document.getElementById('anime-container');
    const sizeToggleContainer = document.getElementById('size-toggle-container');
    
    const sizeBtns = document.querySelectorAll('.size-btn');
    let currentGridSize = 'size-m'; // default
    container.classList.add(currentGridSize);
    
    gridBtn.addEventListener('click', () => {
        gridBtn.classList.add('active');
        listBtn.classList.remove('active');
        
        container.classList.remove('list-view');
        container.classList.add('grid-view');
        
        // Restore grid size class if it was removed
        container.classList.add(currentGridSize);
        sizeToggleContainer.style.display = 'flex';
        
        // We do not modify the inline display of status-indicators here because
        // we keep the HTML strict and let CSS handle the list vs grid styles.
    });
    
    listBtn.addEventListener('click', () => {
        listBtn.classList.add('active');
        gridBtn.classList.remove('active');
        
        container.classList.remove('grid-view');
        container.classList.add('list-view');
        
        // Remove current grid size class so list view styling doesn't break
        // Actually the user stated: "maar de lijst mag er niet op veranderen"
        // Meaning list view CSS shouldn't be affected by whether S/M/L is active.
        // The CSS handles: #anime-container.list-view
    });
    
    sizeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (container.classList.contains('list-view')) return; // Ignore if list view
            
            sizeBtns.forEach(b => b.classList.remove('active'));
            const target = e.target;
            target.classList.add('active');
            
            const newSize = `size-${target.getAttribute('data-size')}`;
            
            ['size-s', 'size-m', 'size-l'].forEach(c => container.classList.remove(c));
            container.classList.add(newSize);
            currentGridSize = newSize;
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

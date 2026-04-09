import { AnimeRepository } from './domein/AnimeRepository.js';
import { DataStore } from './domein/DataStore.js';
import { DetailRenderer } from './domein/DetailRenderer.js';
import { StatusUpdater } from './domein/StatusUpdater.js';
import { AnilistApi } from './domein/AnilistApi.js';

let repository = new AnimeRepository();
let currentAnime = null;

async function init() {
    const data = await DataStore.loadInitialData();
    repository.loadFromData(data);
    
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    
    if (id) {
        currentAnime = repository.getById(id);
        if (currentAnime) {
            renderDetail();
            
            // Hydrate AniList single
            if (!currentAnime.bannerImage || currentAnime.items.some(i => !i.episodesCount || i.episodesCount === 0)) {
                const searchTerm = currentAnime.items.length > 0 ? currentAnime.items[0].title : currentAnime.title;
                const apiData = await AnilistApi.fetchMediaByTitle(searchTerm);
                if (apiData) {
                    currentAnime.coverImage = apiData.coverImage.large;
                    currentAnime.bannerImage = apiData.bannerImage;
                    if (currentAnime.items.length > 0 && (!currentAnime.items[0].episodesCount || currentAnime.items[0].episodesCount === 0)) {
                         currentAnime.items[0].episodesCount = apiData.episodes || 12; // Fallback to 12
                    }
                    DataStore.save(repository);
                    renderDetail(); // Re-render with new data
                }
            }
        } else {
            document.getElementById('detail-container').innerHTML = '<p class="text-muted">Anime niet gevonden.</p>';
        }
    } else {
        window.location.href = 'index.html';
    }
}

function renderDetail() {
    const container = document.getElementById('detail-container');
    
    // Save which accordions are currently open before wiping the container
    const openItemIds = Array.from(container.querySelectorAll('.item-accordion-wrapper.is-open'))
        .map(wrapper => wrapper.getAttribute('data-item-id'));

    DetailRenderer.renderDetail(container, currentAnime, handleItemStatus, handleGlobalStatus, null, handleEpisodeToggle, openRatingModal, openItemIds);
}

function openRatingModal() {
    const overlay = document.getElementById('modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const ratingInput = document.getElementById('rating-number');

    if (overlay && modalTitle && ratingInput && currentAnime) {
        modalTitle.textContent = currentAnime.title;
        ratingInput.value = currentAnime.rating > 0 ? currentAnime.rating : "";
        overlay.classList.remove('hidden');
    }
}

window.saveGlobalRating = function() {
    const overlay = document.getElementById('modal-overlay');
    const ratingInput = document.getElementById('rating-number');
    
    if (currentAnime) {
        import('./domein/RatingManager.js').then(module => {
            let val = parseFloat(ratingInput.value);
            if (isNaN(val)) val = 0;
            if (val < 0) val = 0;
            if (val > 10) val = 10;
            
            module.RatingManager.updateRating(currentAnime, val);
            DataStore.save(repository);
            renderDetail();
            if (overlay) overlay.classList.add('hidden');
        }).catch(err => console.error(err));
    }
};

function setupRatingModalBackground() {
    const overlay = document.getElementById('modal-overlay');
    if (!overlay) return;
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.classList.add('hidden');
        }
    });
}

function handleEpisodeToggle(item, episodeNum) {
    if (currentAnime) {
        StatusUpdater.toggleEpisode(item, episodeNum, currentAnime);
        DataStore.save(repository);
        renderDetail();
    }
}

function handleItemStatus(item, newStatus) {
    if (currentAnime) {
        StatusUpdater.updateItemStatus(item, newStatus, currentAnime);
        DataStore.save(repository);
        renderDetail();
    }
}

function handleGlobalStatus(anime, newStatus) {
    StatusUpdater.updateGlobalStatus(anime, newStatus);
    DataStore.save(repository);
    renderDetail();
}

function setupThemeToggle() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    
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

document.addEventListener('DOMContentLoaded', () => {
    init();
    setupThemeToggle();
    setupRatingModalBackground();
});
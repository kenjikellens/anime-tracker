import { AnimeRepository } from './domein/AnimeRepository.js';
import { DataStore } from './domein/DataStore.js';
import { DetailRenderer } from './domein/DetailRenderer.js';
import { StatusUpdater } from './domein/StatusUpdater.js';
import { AnilistApi } from './domein/AnilistApi.js';
import { ThemeManager } from './domein/ThemeManager.js';

// Detail page state. The current anime comes from `card.html?id=<id>`.
let repository = new AnimeRepository();
let currentAnime = null;
let currentRatingTarget = null;
let currentRatingType = null;

/**
 * Bootstraps the detail page and resolves the selected anime.
 */
async function init() {
    ThemeManager.initTheme();
    const data = await DataStore.loadInitialData();
    repository.loadFromData(data);

    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');

    if (id) {
        currentAnime = repository.getById(id);
        if (currentAnime) {
            renderDetail();

            // Hydrate missing poster/banner data for this one record only.
            if (!currentAnime.bannerImage || currentAnime.items.some(i => !i.episodesCount || i.episodesCount === 0)) {
                const searchTerm = currentAnime.items.length > 0 ? currentAnime.items[0].title : currentAnime.title;
                const apiData = await AnilistApi.fetchMediaByTitle(searchTerm);
                if (apiData) {
                    currentAnime.coverImage = apiData.coverImage.large;
                    currentAnime.bannerImage = apiData.bannerImage;
                    if (currentAnime.items.length > 0 && (!currentAnime.items[0].episodesCount || currentAnime.items[0].episodesCount === 0)) {
                        currentAnime.items[0].episodesCount = apiData.episodes || 12;
                    }
                    DataStore.save(repository);
                    renderDetail();
                }
            }
        } else {
            document.getElementById('detail-container').innerHTML = '<p class="text-muted">Anime niet gevonden.</p>';
        }
    } else {
        window.location.href = 'index.html';
    }
}

/**
 * Renders the detail view while preserving open accordion rows.
 */
function renderDetail() {
    const container = document.getElementById('detail-container');
    const openItemIds = Array.from(container.querySelectorAll('.item-accordion-wrapper.is-open'))
        .map(wrapper => wrapper.getAttribute('data-item-id'));

    DetailRenderer.renderDetail(container, currentAnime, handleItemStatus, handleGlobalStatus, null, handleEpisodeToggle, openRatingModal, openItemIds, openItemRatingModal);
}

/**
 * Opens the shared rating modal for the current anime.
 */
function openRatingModal() {
    const overlay = document.getElementById('modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const ratingInput = document.getElementById('rating-number');

    if (overlay && modalTitle && ratingInput && currentAnime) {
        currentRatingTarget = currentAnime;
        currentRatingType = 'anime';
        modalTitle.textContent = currentAnime.title;
        ratingInput.value = currentAnime.rating > 0 ? currentAnime.rating : "";
        overlay.classList.remove('hidden');
    }
}

/**
 * Opens the shared rating modal for a specific item.
 */
function openItemRatingModal(item) {
    const overlay = document.getElementById('modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const ratingInput = document.getElementById('rating-number');

    if (overlay && modalTitle && ratingInput && item) {
        currentRatingTarget = item;
        currentRatingType = 'item';
        modalTitle.textContent = item.title;
        ratingInput.value = item.rating > 0 ? item.rating : "";
        overlay.classList.remove('hidden');
    }
}

/**
 * Shared modal save handler used by `card.html`.
 */
window.saveGlobalRating = function() {
    const overlay = document.getElementById('modal-overlay');
    const ratingInput = document.getElementById('rating-number');

    if (currentRatingTarget) {
        import('./domein/RatingManager.js').then(module => {
            let val = parseFloat(ratingInput.value);
            if (isNaN(val)) val = 0;
            if (val < 0) val = 0;
            if (val > 10) val = 10;

            if (currentRatingType === 'anime') {
                module.RatingManager.updateRating(currentRatingTarget, val);
            } else if (currentRatingType === 'item') {
                module.RatingManager.updateItemRating(currentRatingTarget, val);
            }
            
            DataStore.save(repository);
            renderDetail();
            
            if (overlay) {
                overlay.classList.add('hidden');
            }
            currentRatingTarget = null;
            currentRatingType = null;
        }).catch(err => console.error(err));
    }
};

/**
 * Closes the rating modal when the backdrop is clicked.
 */
function setupRatingModalBackground() {
    const overlay = document.getElementById('modal-overlay');
    if (!overlay) return;
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.classList.add('hidden');
        }
    });
}

/**
 * Updates a single episode checkbox and persists the change.
 */
function handleEpisodeToggle(item, episodeNum) {
    if (currentAnime) {
        StatusUpdater.toggleEpisode(item, episodeNum, currentAnime);
        DataStore.save(repository);
        renderDetail();
    }
}

/**
 * Updates one season/item status inside the detail accordion.
 */
function handleItemStatus(item, newStatus) {
    if (currentAnime) {
        StatusUpdater.updateItemStatus(item, newStatus, currentAnime);
        DataStore.save(repository);
        renderDetail();
    }
}

/**
 * Updates the top-level anime status from the sidebar dropdown.
 */
function handleGlobalStatus(anime, newStatus) {
    StatusUpdater.updateGlobalStatus(anime, newStatus);
    DataStore.save(repository);
    renderDetail();
}

document.addEventListener('DOMContentLoaded', () => {
    init();
    ThemeManager.bindToggle('theme-toggle');
    setupRatingModalBackground();
});

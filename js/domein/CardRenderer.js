import { RatingManager } from './RatingManager.js';
import { DATA_ATTRS } from './UIConstants.js';

const SVG_ICONS = {
    star: `<svg class="svg-icon svg-icon-margin"><use href="#icon-star"></use></svg>`,
    starHalf: `<svg class="svg-icon svg-icon-margin svg-icon-half"><use href="#icon-star-half"></use></svg>`,
    play: `<svg class="svg-icon"><use href="#icon-play"></use></svg>`,
    bell: `<svg class="svg-icon"><use href="#icon-bell"></use></svg>`,
    chevronRight: `<svg class="expand-icon svg-icon-large"><use href="#icon-chevron-right"></use></svg>`
};

/**
 * Renders overview cards for the anime list page.
 * Linked to: `#anime-container` in `index.html`.
 */
export class CardRenderer {
    /**
     * Generates HTML markup for the card poster, including hue gradient fallbacks.
     * @param {Object} anime - The anime model.
     * @returns {string} HTML markup string for poster image or fallback.
     */
    static getPosterMarkup(anime) {
        const hash = anime.title.split('').reduce((acc, char) => char.charCodeAt(0) + acc, 0);
        const hue = hash % 360;

        const loaderHtml = `
            <div class="card-internal-loader">
                <svg width="32" height="32" viewBox="0 0 32 32" class="card-spinner-svg">
                    <circle cx="16" cy="16" r="12" class="card-spinner-circle" />
                </svg>
            </div>
        `;

        if (anime.coverImage) {
            return `${loaderHtml}<img src="${anime.coverImage}" class="poster-img" loading="lazy" />`;
        }
        return `<div class="poster-fallback" style="--poster-hue: ${hue};">${anime.title.substring(0,2)}</div>`;
    }

    /**
     * Renders a subset of anime cards (a batch) and appends them to the container.
     * This affects the `#anime-container` DOM element by dynamically adding card components.
     * @param {HTMLElement} container - Target container element.
     * @param {Array} animes - Array of anime models.
     * @param {Function} onRatingClick - Rating click handler.
     * @param {boolean} [isFirstBatch=false] - Whether this is the initial batch.
     * @param {Function} [onQueueToggle=null] - Top queue toggle handler.
     */
    static renderBatch(container, animes, onRatingClick, isFirstBatch = false, onQueueToggle = null) {
        if (isFirstBatch) {
            container.innerHTML = '';
            if (animes.length === 0) {
                const emptyMsg = document.createElement('p');
                emptyMsg.dataset.empty = 'true';
                emptyMsg.textContent = 'Geen animes gevonden.';
                container.appendChild(emptyMsg);
                return;
            }
        }

        let wrapper = container.querySelector('.status-column');
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.className = 'status-column';
            container.appendChild(wrapper);
        }
        
        const fragment = document.createDocumentFragment();
        animes.forEach(anime => {
            fragment.appendChild(this.createCard(anime, onRatingClick, onQueueToggle));
        });
        wrapper.appendChild(fragment);
    }

    /**
     * Renders all provided anime cards at once by delegating to the batch renderer.
     * @param {HTMLElement} container - Target container element.
     * @param {Array} animes - Array of anime models.
     * @param {Function} onRatingClick - Rating click handler.
     * @param {Function} [onQueueToggle=null] - Top queue toggle handler.
     */
    static renderAll(container, animes, onRatingClick, onQueueToggle = null) {
        this.renderBatch(container, animes, onRatingClick, true, onQueueToggle);
    }

    /**
     * Re-renders and updates the poster image area for a specific anime card.
     * @param {Object} anime - The anime model whose card image should be updated.
     */
    static updateCardImage(anime) {
        const div = document.querySelector(`.anime-card[${DATA_ATTRS.ITEM_ID}="${anime.id}"]`);
        if (div) {
            const posterDiv = div.querySelector('.card-poster');
            if (posterDiv) {
                posterDiv.innerHTML = this.getPosterMarkup(anime);
                const imgEl = posterDiv.querySelector('.poster-img');
                if (imgEl) {
                    if (imgEl.complete) {
                        requestAnimationFrame(() => { div.dataset.cardLoading = 'false'; });
                    } else {
                        imgEl.onload = () => { div.dataset.cardLoading = 'false'; };
                        imgEl.onerror = () => { div.dataset.cardLoading = 'false'; };
                    }
                } else {
                    div.dataset.cardLoading = 'false';
                }
            }
        }
    }

    /**
     * Creates a fully structured card wrapper with backing deck layers and the main card.
     * @param {Object} anime - The anime model data to render.
     * @param {Function} onRatingClick - Callback trigger when the rating badge is clicked.
     * @param {Function} [onQueueToggle=null] - Callback trigger when the queue button is clicked.
     * @returns {HTMLElement} The populated anime card wrapper element.
     */
    static createCard(anime, onRatingClick, onQueueToggle = null) {
        const template = document.getElementById('anime-card-template');
        if (!template) {
            throw new Error('anime-card-template not found in document');
        }

        const clone = document.importNode(template.content, true);
        const wrapper = clone.firstElementChild;
        wrapper.setAttribute(DATA_ATTRS.ITEM_ID, anime.id);

        const itemCount = anime.items.length;

        const mainCard = wrapper.querySelector('.anime-card');
        mainCard.setAttribute(DATA_ATTRS.ITEM_ID, anime.id);
        mainCard.setAttribute(DATA_ATTRS.STATUS, anime.status);
        mainCard.setAttribute('data-has-airing', anime.items.some(item => item.status === 3) ? 'true' : 'false');
        mainCard.setAttribute('data-has-upcoming', anime.items.some(item => item.status === 2) ? 'true' : 'false');
        
        mainCard.dataset.cardLoading = anime.coverImage ? 'true' : 'false';

        const cardClass = RatingManager.getCardClass(anime.rating);
        if (cardClass) {
            mainCard.dataset.glow = cardClass;
            mainCard.classList.add(cardClass);
        }
        if (anime.status === 1) {
            mainCard.classList.add("status-watched");
        } else if (anime.status === 4) {
            mainCard.classList.add("status-onhold");
        }

        const posterDiv = wrapper.querySelector('.card-poster');
        posterDiv.innerHTML = this.getPosterMarkup(anime);

        const imgEl = posterDiv.querySelector('.poster-img');
        if (imgEl) {
            if (imgEl.complete) {
                // Ensure initial frame paint of card shell and spinner before fading loader
                requestAnimationFrame(() => {
                    setTimeout(() => {
                        mainCard.dataset.cardLoading = 'false';
                    }, 50);
                });
            } else {
                imgEl.onload = () => { mainCard.dataset.cardLoading = 'false'; };
                imgEl.onerror = () => { mainCard.dataset.cardLoading = 'false'; };
            }
        }

        // Top Watch Queue badge on poster
        const inQueue = typeof anime.watchRank === 'number' && anime.watchRank > 0;
        const queueBadge = document.createElement('div');
        queueBadge.className = `card-queue-badge${anime.watchRank === 1 ? ' rank-top' : ''}`;
        if (inQueue) {
            queueBadge.textContent = `#${anime.watchRank}`;
            posterDiv.appendChild(queueBadge);
        }

        wrapper.querySelector('.card-title span').textContent = anime.title;
        wrapper.querySelector('.card-subtitle').textContent = `${itemCount} items`;

        const statusCell = wrapper.querySelector('.card-status-cell');
        if (statusCell) {
            let statusText = 'Te Bekijken';
            if (anime.status === 1) statusText = 'Bekeken';
            else if (anime.status === 0) statusText = 'Bezig';
            else if (anime.status === 4) statusText = 'Verder Kijken';

            if (anime.items.some(item => item.status === 3)) {
                statusText = anime.status === 1 ? 'Bekeken (Airing)' : 'Airing';
            } else if (anime.items.some(item => item.status === 2)) {
                statusText = anime.status === 1 ? 'Bekeken (Upcoming)' : 'Upcoming';
            }
            statusCell.textContent = statusText;
        }

        const avgRating = anime.getAverageItemRating();
        wrapper.querySelector('.avg-rating-val').textContent = avgRating > 0 ? avgRating.toFixed(1) : '—';

        const ratingValSpan = wrapper.querySelector('.rating-val');
        ratingValSpan.textContent = anime.rating > 0 ? anime.rating.toFixed(1) : 'NR';

        const ratingBtn = wrapper.querySelector('.rating-badge');
        const badgeTier = RatingManager.getBadgeClass(anime.rating);
        if (badgeTier) {
            ratingBtn.dataset.ratingTier = badgeTier;
            ratingBtn.classList.add(`r-${badgeTier}`);
        }
        ratingBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (onRatingClick) onRatingClick(anime);
        });

        mainCard.addEventListener('click', () => {
            window.location.hash = `#/anime/${anime.id}`;
        });

        return wrapper;
    }
}

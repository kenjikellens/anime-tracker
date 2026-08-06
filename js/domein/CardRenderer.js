import { RatingManager } from './RatingManager.js';

const SVG_ICONS = {
    star: `<svg style="width: 1em; height: 1em; display: inline-block; vertical-align: middle; margin-right: 4px;"><use href="#icon-star"></use></svg>`,
    starHalf: `<svg style="width: 1em; height: 1em; display: inline-block; vertical-align: middle; margin-right: 4px; opacity: 0.7;"><use href="#icon-star-half"></use></svg>`,
    play: `<svg style="width: 1em; height: 1em; display: inline-block; vertical-align: middle;"><use href="#icon-play"></use></svg>`,
    bell: `<svg style="width: 1em; height: 1em; display: inline-block; vertical-align: middle;"><use href="#icon-bell"></use></svg>`,
    chevronRight: `<svg class="expand-icon" style="width: 1.2em; height: 1.2em; vertical-align: middle;"><use href="#icon-chevron-right"></use></svg>`
};

/**
 * Renders overview cards for the anime list page.
 * Linked to: `#anime-container` in `index.html`.
 */
export class CardRenderer {
    /**
     * Generates HTML markup for the card poster, including hue gradient fallbacks and release badges.
     */
    static getPosterMarkup(anime) {
        const hash = anime.title.split('').reduce((acc, char) => char.charCodeAt(0) + acc, 0);
        const hue = hash % 360;

        let posterContent = `<div style="width:100%; height:100%; background: linear-gradient(135deg, hsl(${hue}, 60%, 50%), hsl(${(hue + 40) % 360}, 70%, 40%)); display:flex; align-items:center; justify-content:center; color:#fff; font-size: 24px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; box-shadow: inset 0 0 20px rgba(0,0,0,0.1); border-radius: 6px;">${anime.title.substring(0,2)}</div>`;
        if (anime.coverImage) {
            posterContent = `<img src="${anime.coverImage}" style="width:100%; height:100%; object-fit:cover; border-radius: 6px;" loading="lazy" />`;
        }

        const releaseLabels = [];
        if (anime.items.some(item => item.status === 3)) {
            releaseLabels.push(`
                <div class="label-release label-airing" aria-label="Airing content">
                    <span class="label-release-icon">${SVG_ICONS.play}</span>
                    <span class="label-release-text">AIRING</span>
                </div>
            `);
        }
        if (anime.items.some(item => item.status === 2)) {
            releaseLabels.push(`
                <div class="label-release label-upcoming" aria-label="Upcoming content">
                    <span class="label-release-icon">${SVG_ICONS.bell}</span>
                    <span class="label-release-text">UPCOMING</span>
                </div>
            `);
        }

        return `${posterContent}${releaseLabels.join('')}`;
    }

    /**
     * Renders a subset of anime cards (a batch) and appends them to the container.
     * This affects the `#anime-container` DOM element by dynamically adding card components.
     */
    static renderBatch(container, animes, onRatingClick, isFirstBatch = false) {
        if (isFirstBatch) {
            container.innerHTML = '';
            if (animes.length === 0) {
                container.innerHTML = '<p class="text-muted" style="padding: 20px;">Geen animes gevonden.</p>';
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
            fragment.appendChild(this.createCard(anime, onRatingClick));
        });
        wrapper.appendChild(fragment);
    }

    /**
     * Renders all provided anime cards at once by delegating to the batch renderer.
     * This affects the `#anime-container` DOM element by replacing its entire content.
     */
    static renderAll(container, animes, onRatingClick) {
        this.renderBatch(container, animes, onRatingClick, true);
    }

    /**
     * Re-renders and updates the poster image area for a specific anime card.
     * This locates the rendered card by ID and replaces its poster contents.
     * @param {Object} anime - The anime model whose card image should be updated.
     */
    static updateCardImage(anime) {
        const div = document.querySelector(`.anime-card[data-id="${anime.id}"]`);
        if (div) {
            const posterDiv = div.querySelector('.card-poster');
            if (posterDiv) {
                posterDiv.innerHTML = this.getPosterMarkup(anime);
            }
        }
    }

    /**
     * Creates a fully structured card wrapper with backing deck layers and the main card.
     * This clones the HTML5 template from the document, fills in data, and binds event handlers.
     * @param {Object} anime - The anime model data to render.
     * @param {Function} onRatingClick - Callback trigger when the rating badge is clicked.
     * @returns {HTMLElement} The populated anime card wrapper element.
     */
    static createCard(anime, onRatingClick) {
        const template = document.getElementById('anime-card-template');
        if (!template) {
            throw new Error('anime-card-template not found in document');
        }

        const clone = document.importNode(template.content, true);
        const wrapper = clone.firstElementChild;
        wrapper.setAttribute('data-id', anime.id);

        const itemCount = anime.items.length;
        // Single container per anime: card-stack-layers disabled for clean single card design

        const mainCard = wrapper.querySelector('.anime-card');
        mainCard.setAttribute('data-id', anime.id);
        mainCard.setAttribute('data-status', anime.status);
        mainCard.setAttribute('data-has-airing', anime.items.some(item => item.status === 3) ? 'true' : 'false');
        mainCard.setAttribute('data-has-upcoming', anime.items.some(item => item.status === 2) ? 'true' : 'false');
        // Keep mainCard uniform without rating or status background class overrides

        const posterDiv = wrapper.querySelector('.card-poster');
        posterDiv.innerHTML = this.getPosterMarkup(anime);

        wrapper.querySelector('.card-title span').textContent = anime.title;
        wrapper.querySelector('.card-subtitle').textContent = `${itemCount} items`;

        const avgRating = anime.getAverageItemRating();
        wrapper.querySelector('.avg-rating-val').textContent = avgRating > 0 ? avgRating.toFixed(1) : '—';

        const ratingValSpan = wrapper.querySelector('.rating-val');
        ratingValSpan.textContent = anime.rating > 0 ? anime.rating.toFixed(1) : 'NR';

        const ratingBtn = wrapper.querySelector('.rating-badge');
        const badgeClass = RatingManager.getBadgeClass(anime.rating);
        if (badgeClass) {
            ratingBtn.classList.add(badgeClass);
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

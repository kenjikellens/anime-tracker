import { RatingManager } from './RatingManager.js';

const SVG_ICONS = {
    star: `<svg viewBox="0 0 24 24" fill="currentColor" style="width: 1em; height: 1em; display: inline-block; vertical-align: middle; margin-right: 4px;"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`,
    starHalf: `<svg viewBox="0 0 24 24" fill="currentColor" style="width: 1em; height: 1em; display: inline-block; vertical-align: middle; margin-right: 4px; opacity: 0.7;"><path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27V2z"/><path d="M22 9.24l-7.19-.62L12 2v15.27l6.18 3.73-1.64-7.03L22 9.24zM12 15.4V6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28L12 15.4z" opacity="0.4"/></svg>`,
    play: `<svg viewBox="0 0 24 24" fill="currentColor" style="width: 1em; height: 1em; display: inline-block; vertical-align: middle;"><path d="M8 5v14l11-7z"/></svg>`,
    bell: `<svg viewBox="0 0 24 24" fill="currentColor" style="width: 1em; height: 1em; display: inline-block; vertical-align: middle;"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>`,
    chevronRight: `<svg viewBox="0 0 24 24" fill="currentColor" class="expand-icon" style="width: 1.2em; height: 1.2em; vertical-align: middle;"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg>`
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
     * Replaces the contents of the container with cards.
     */
    static renderAll(container, animes, onRatingClick) {
        container.innerHTML = '';
        if (animes.length === 0) {
            container.innerHTML = '<p class="text-muted" style="padding: 20px;">Geen animes gevonden.</p>';
            return;
        }
        
        const wrapper = document.createElement('div');
        wrapper.className = 'status-column';
        
        animes.forEach(anime => {
            wrapper.appendChild(CardRenderer.createCard(anime, onRatingClick));
        });
        
        container.appendChild(wrapper);
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
     * Attaches click event handlers to the card and its rating badge.
     * @param {Object} anime - The anime model data to render.
     * @param {Function} onRatingClick - Callback trigger when the rating badge is clicked.
     * @returns {HTMLElement} The populated anime card wrapper element.
     */
    static createCard(anime, onRatingClick) {
        const wrapper = document.createElement('div');
        wrapper.className = 'anime-card-wrapper';
        wrapper.setAttribute('data-id', anime.id);

        const itemCount = anime.items.length;
        let stackMarkup = '';
        if (itemCount > 1) {
            const layersCount = Math.min(itemCount, 6);
            for (let i = 1; i <= layersCount; i++) {
                stackMarkup += `<div class="card-stack-layer layer-${i}"></div>`;
            }
        }

        const avgRating = anime.getAverageItemRating();

        wrapper.innerHTML = `
            ${stackMarkup}
            <div class="anime-card ${RatingManager.getCardClass(anime.rating)}" data-status="${anime.status}" data-has-airing="${anime.items.some(item => item.status === 3) ? 'true' : 'false'}" data-has-upcoming="${anime.items.some(item => item.status === 2) ? 'true' : 'false'}" data-id="${anime.id}">
                <div class="card-poster">
                    ${this.getPosterMarkup(anime)}
                </div>
                <div class="card-info" style="gap: 8px;">
                    <div class="card-header">
                        <div class="card-title">
                            <span style="font-size:1.1rem; line-height: 1.2;">${anime.title}</span>
                        </div>
                    </div>
                    <div class="card-subtitle" style="font-size: 0.85rem; color: var(--text-muted); opacity: 0.8;">${anime.items.length} items</div>
                    <div class="card-actions" style="display: flex; gap: 12px; position: absolute; bottom: 8px; right: 8px; z-index: 10; align-items: center;">
                        <div class="avg-rating-text" style="pointer-events: none; color: var(--text-muted);" title="Gemiddelde item-rating">
                            ${SVG_ICONS.starHalf} ${avgRating > 0 ? avgRating.toFixed(1) : '—'}
                        </div>
                        <div class="rating-badge ${RatingManager.getBadgeClass(anime.rating)}" style="cursor: pointer; position: relative !important; bottom: auto !important; right: auto !important; z-index: auto !important;">
                            ${SVG_ICONS.star} ${anime.rating > 0 ? anime.rating.toFixed(1) : 'NR'}
                        </div>
                    </div>
                </div>
                ${SVG_ICONS.chevronRight}
            </div>
        `;

        const mainCard = wrapper.querySelector('.anime-card');
        if (anime.status === 1) {
            mainCard.classList.add("status-watched");
        }

        const ratingBtn = wrapper.querySelector('.rating-badge');
        ratingBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (onRatingClick) onRatingClick(anime);
        });

        mainCard.addEventListener('click', () => {
            window.location.href = `card.html?id=${anime.id}`;
        });

        return wrapper;
    }
}

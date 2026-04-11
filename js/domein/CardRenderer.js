import { RatingManager } from './RatingManager.js';

/**
 * Renders overview cards for the anime list page.
 * Linked to: `#anime-container` in `index.html`.
 */
export class CardRenderer {
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
     * Updates only the poster area for one already rendered card.
     */
    static updateCardImage(anime) {
        const div = document.querySelector(`.anime-card[data-id="${anime.id}"]`);
        if (div && anime.coverImage) {
            const posterDiv = div.querySelector('.card-poster');
            posterDiv.innerHTML = `<img src="${anime.coverImage}" style="width:100%; height:100%; object-fit:cover; border-radius: 6px;" />`;
        }
    }

    /**
     * Builds a single anime card and wires its click handlers.
     */
    static createCard(anime, onRatingClick) {
        const div = document.createElement('div');
        div.className = `anime-card ${RatingManager.getCardClass(anime.rating)}`;
        div.setAttribute('data-status', anime.status);
        div.setAttribute('data-id', anime.id);

        if (anime.status === 1) {
            div.classList.add("status-watched");
        }
        
        const hash = anime.title.split('').reduce((acc, char) => char.charCodeAt(0) + acc, 0);
        const hue = hash % 360;
        
        let posterContent = `<div style="width:100%; height:100%; background: linear-gradient(135deg, hsl(${hue}, 60%, 50%), hsl(${(hue + 40) % 360}, 70%, 40%)); display:flex; align-items:center; justify-content:center; color:#fff; font-size: 24px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; box-shadow: inset 0 0 20px rgba(0,0,0,0.1); border-radius: 6px;">${anime.title.substring(0,2)}</div>`;
        if (anime.coverImage) {
            posterContent = `<img src="${anime.coverImage}" style="width:100%; height:100%; object-fit:cover; border-radius: 6px;" loading="lazy" />`;
        }
        
        div.innerHTML = `
            <div class="card-poster">
                ${posterContent}
            </div>
            <div class="card-info" style="gap: 8px;">
                <div class="card-header">
                    <div class="card-title">
                        <span style="font-size:1.1rem; line-height: 1.2;">${anime.title}</span>
                    </div>
                </div>
                <div style="font-size: 0.85rem; color: var(--text-muted); opacity: 0.8;">${anime.items.length} items</div>
                <div class="card-actions">
                    <div class="rating-badge ${RatingManager.getBadgeClass(anime.rating)}" style="cursor: pointer;">
                        <i class="fas fa-star"></i> ${anime.rating > 0 ? anime.rating.toFixed(1) : 'NR'}
                    </div>
                </div>
            </div>
            <i class="fas fa-chevron-right expand-icon"></i>
        `;
        
        const ratingBtn = div.querySelector('.rating-badge');
        ratingBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (onRatingClick) onRatingClick(anime);
        });
        
        div.addEventListener('click', () => {
            window.location.href = `card.html?id=${anime.id}`;
        });
        
        return div;
    }
}

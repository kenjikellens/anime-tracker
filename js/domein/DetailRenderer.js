import { RatingManager } from './RatingManager.js';

// WATCH_PROVIDER_DOMAIN: The base domain of the streaming provider for playing anime.
const WATCH_PROVIDER_DOMAIN = "miruro.ru";

// WATCH_PROVIDER_SEARCH_PATH: The search path query format used by the streaming provider.
const WATCH_PROVIDER_SEARCH_PATH = "/search?query=";

/**
 * Renders the detailed anime page and its expandable item rows.
 * Linked to: `#detail-container` in `card.html`.
 */
export class DetailRenderer {
    /**
     * Builds the full detailed sidebar, item accordions, and status dropdowns for an anime group.
     * Restricts the global dropdown to non-Nieuw statuses, and includes Nieuw in item dropdowns.
     */
    static renderDetail(container, anime, onItemStatusChange, onGlobalStatusChange, onRatingChange, onEpisodeToggle, onRatingClick = null, openItemIds = [], onItemRatingClick = null) {
        container.innerHTML = '';
        
        let globalStatusSelect = `
            <select class="status-current detail-action-btn" id="global-status-select" style="width: 100%;">
                <option value="-1" ${anime.status === -1 ? 'selected' : ''}>Te Bekijken</option>
                <option value="0" ${anime.status === 0 ? 'selected' : ''}>Bezig</option>
                <option value="1" ${anime.status === 1 ? 'selected' : ''}>Bekeken</option>
            </select>
        `;
        const title = anime?.title || '';
        const initials = title.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '??';
        const hash = title.split('').reduce((acc, char) => char.charCodeAt(0) + acc, 0);
        const hue = hash % 360;

        const posterHtml = anime.coverImage
            ? `<img class="detail-poster" src="${anime.coverImage}" alt="${title} cover" loading="lazy" />`
            : `<div class="detail-poster-fallback" style="background: linear-gradient(135deg, hsl(${hue}, 60%, 45%), hsl(${(hue + 40) % 360}, 70%, 35%));">${initials}</div>`;

        const layout = document.createElement('div');
        layout.className = 'anime-detail-layout-v3';

        // --- SIDEBAR ---
        const sidebar = document.createElement('aside');
        /** Applies glow-gold effect to the sidebar for legendary-rated anime (>= 9). */
        const sidebarGlow = RatingManager.getCardClass(anime.rating);
        sidebar.className = `anime-detail-sidebar-v3 ${sidebarGlow}`.trim();

        const posterWrap = document.createElement('div');
        posterWrap.className = 'sidebar-poster-wrap';
        posterWrap.innerHTML = posterHtml;

        const sidebarInfo = document.createElement('div');
        sidebarInfo.className = 'sidebar-info';

        const sidebarTitle = document.createElement('h2');
        sidebarTitle.className = 'sidebar-title';
        sidebarTitle.textContent = title;

        const avgRating = anime.getAverageItemRating();

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'sidebar-actions-v3';

        // Helper to generate 10-segmented bars HTML with exact rating category colors.
        const createSegmentsHtml = (score, isSmall = false) => {
            let html = `<div class="segmented-rating-bar${isSmall ? ' small' : ''}">`;
            const colors = [
                '#e74c3c', '#e74c3c', '#e74c3c', '#e74c3c', // 1, 2, 3, 4 -> Red / Garbage (< 4.0)
                '#e67e22',                                 // 5 -> Orange / Bad (4.0+)
                '#f1c40f',                                 // 6 -> Yellow / Regular (5.0+)
                '#a2d149',                                 // 7 -> Lime Green / Good (6.0+)
                '#2ecc71',                                 // 8 -> Bright Green / Great (7.0+)
                '#27ae60',                                 // 9 -> Dark Green / Awesome (8.0+)
                '#ffd700'                                  // 10 -> Gold / Cinema (9.0+)
            ];
            for (let i = 1; i <= 10; i++) {
                const fillWidth = Math.min(100, Math.max(0, (score - (i - 1)) * 100));
                const color = colors[i - 1];
                html += `
                    <div class="segment">
                        <div class="segment-fill" style="width: 0%; background-color: ${color}; transition: width 0.10s linear !important; transition-delay: ${(i - 1) * 0.10}s !important;" data-width="${fillWidth}%"></div>
                    </div>
                `;
            }
            html += `</div>`;
            return html;
        };

        // Helper to determine the text color of the rating display.
        const getScoreColor = (score) => {
            if (!score || score === 0) return 'var(--text-muted)';
            if (score >= 9.0) return '#ffd700';
            if (score >= 8.0) return '#27ae60';
            if (score >= 7.0) return '#2ecc71';
            if (score >= 6.0) return '#a2d149';
            if (score >= 5.0) return '#f1c40f';
            if (score >= 4.0) return '#e67e22';
            return '#e74c3c';
        };

        const userScoreColor = getScoreColor(anime.rating);
        const avgScoreColor = getScoreColor(avgRating);

        actionsDiv.innerHTML = `
            <div class="status-alinea">
                ${globalStatusSelect}
            </div>
            <div class="sidebar-ratings-container">
                <div class="sidebar-rating-block rating-actionable" title="Klik om te beoordelen">
                    <div class="sidebar-rating-label">
                        <span>Jouw Beoordeling</span>
                        <span class="sidebar-rating-val" style="color: ${userScoreColor};">
                            ${anime.rating > 0 ? anime.rating.toFixed(1) + '/10' : 'NR'}
                        </span>
                    </div>
                    ${createSegmentsHtml(anime.rating)}
                </div>
                <div class="sidebar-rating-block small" title="Gemiddelde rating">
                    <div class="sidebar-rating-label">
                        <span>Gemiddelde</span>
                        <span class="sidebar-rating-val" style="color: ${avgScoreColor};">
                            ${avgRating > 0 ? avgRating.toFixed(1) + '/10' : '—'}
                        </span>
                    </div>
                    ${createSegmentsHtml(avgRating, true)}
                </div>
            </div>
        `;
        
        const ratingBlock = actionsDiv.querySelector('.rating-actionable');
        if (ratingBlock && onRatingClick) {
            ratingBlock.addEventListener('click', (e) => {
                e.stopPropagation();
                onRatingClick(anime);
            });
        }
        
        const gSelect = actionsDiv.querySelector('#global-status-select');
        gSelect.addEventListener('change', (e) => {
            onGlobalStatusChange(anime, e.target.value);
        });

        sidebarInfo.appendChild(sidebarTitle);
        sidebarInfo.appendChild(actionsDiv);

        sidebar.appendChild(posterWrap);
        sidebar.appendChild(sidebarInfo);

        // --- MAIN CONTENT ---
        const mainContent = document.createElement('main');
        mainContent.className = 'anime-detail-main-v3';
        
        const listDiv = document.createElement('div');
        listDiv.className = 'episodes-list-v3';
        
        if (anime.items.length === 0) {
            listDiv.innerHTML = '<p class="text-muted">Geen episoden/seizoenen gevonden in deze groep.</p>';
        } else {
            anime.items.forEach(item => {
                const isOpen = openItemIds.includes(item.id);
                const rowWrapper = document.createElement('div');
                rowWrapper.className = `item-accordion-wrapper ${isOpen ? 'is-open' : ''}`;
                rowWrapper.setAttribute('data-item-id', item.id);
                
                const typeClass = `type-${(item.type || 'serie').toLowerCase()}`;
                const typeHtml = item.type ? `<span class="item-type-badge ${typeClass}">${item.type}</span>` : '';
                
                const rowHeader = document.createElement('div');
                rowHeader.className = `detail-item-row ${item.status === 1 ? 'watched' : ''}`;
                
                let itemStatusSelect = `
                    <select class="item-status-select" id="status-${item.id}">
                        <option value="2" ${item.status === 2 ? 'selected' : ''}>Nieuw</option>
                        <option value="-1" ${item.status === -1 ? 'selected' : ''}>Te Bekijken</option>
                        <option value="0" ${item.status === 0 ? 'selected' : ''}>Bezig</option>
                        <option value="1" ${item.status === 1 ? 'selected' : ''}>Bekeken</option>
                    </select>
                `;

                let searchTitle = item.title.replace(/(^|\s+)Season\s+\d+/i, '').replace(/(^|\s+)Cour\s+\d+/i, '').trim();
                // Fallback to the parent anime title when item title is generic (e.g. "Season 1")
                if (!searchTitle) searchTitle = anime.title;
                let keyword = encodeURIComponent(searchTitle).replace(/%20/g, '+');
                let watchUrl = `https://${WATCH_PROVIDER_DOMAIN}${WATCH_PROVIDER_SEARCH_PATH}${keyword}`;

                let playBtn = `
                    <a href="${watchUrl}" target="_blank" class="item-play-btn" onclick="event.stopPropagation()" title="Zoek op ${WATCH_PROVIDER_DOMAIN}">
                        <i class="fas fa-play"></i>
                    </a>
                `;

                const itemRatingClass = RatingManager.getBadgeClass(item.rating);
                let itemRatingBtn = `
                    <div class="rating-badge item-rating-badge ${itemRatingClass}" title="Beoordeel dit item" data-item-id="${item.id}">
                        <i class="fas fa-star"></i> 
                        <span>${item.rating > 0 ? item.rating.toFixed(1) : 'NR'}</span>
                    </div>
                `;

                rowHeader.innerHTML = `
                    <i class="fas fa-chevron-down accordion-icon" style="transform: ${isOpen ? 'rotate(-180deg)' : 'rotate(0deg)'};"></i>
                    <div class="title-badge-group">
                        <div class="badge-area">${typeHtml}</div>
                        <div class="detail-item-title">${item.title}</div>
                    </div>
                    <div class="item-actions-group">
                        ${itemRatingBtn}
                        ${itemStatusSelect}
                        ${playBtn}
                    </div>
                `;
                
                const ratingBadge = rowHeader.querySelector('.item-rating-badge');
                if (ratingBadge && onItemRatingClick) {
                    ratingBadge.addEventListener('click', (e) => {
                        e.stopPropagation();
                        onItemRatingClick(item);
                    });
                }
                
                const itemSelect = rowHeader.querySelector('.item-status-select');
                itemSelect.addEventListener('click', e => e.stopPropagation());
                itemSelect.addEventListener('change', (e) => {
                    onItemStatusChange(item, e.target.value);
                });
                
                const episodesContainer = document.createElement('div');
                episodesContainer.className = 'episodes-container';
                
                const epCount = item.episodesCount || 12;
                for (let i = 1; i <= epCount; i++) {
                    const isChecked = item.watchedEpisodes.includes(i) || item.status === 1;
                    const epDiv = document.createElement('div');
                    epDiv.className = "episode-checkbox-wrap";
                    epDiv.innerHTML = `
                        <input type="checkbox" id="ep-${item.id}-${i}" data-ep="${i}" ${isChecked ? 'checked' : ''}>
                        <label for="ep-${item.id}-${i}">Episode ${i}</label>
                    `;
                    
                    const cb = epDiv.querySelector('input');
                    cb.addEventListener('change', (e) => {
                        onEpisodeToggle(item, i);
                    });
                    
                    episodesContainer.appendChild(epDiv);
                }
                
                rowHeader.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const icon = rowHeader.querySelector('.accordion-icon');
                    const isOpening = !rowWrapper.classList.contains('is-open');
                    rowWrapper.classList.toggle('is-open');
                    if (icon) {
                        icon.style.transform = isOpening ? 'rotate(180deg)' : 'rotate(0deg)';
                    }
                });
                
                rowWrapper.appendChild(rowHeader);
                rowWrapper.appendChild(episodesContainer);
                listDiv.appendChild(rowWrapper);
            });
        }

        mainContent.appendChild(listDiv);

        layout.appendChild(sidebar);
        layout.appendChild(mainContent);
        container.appendChild(layout);

        // Staggered loading animation for ratings
        requestAnimationFrame(() => {
            setTimeout(() => {
                container.querySelectorAll('.segment-fill').forEach(fill => {
                    const targetWidth = fill.getAttribute('data-width');
                    if (targetWidth) {
                        fill.style.width = targetWidth;
                    }
                });
            }, 50);
        });
    }
}

import { RatingManager } from './RatingManager.js';
import { DropdownManager } from './DropdownManager.js';
import { DATA_ATTRS } from './UIConstants.js';

// WATCH_PROVIDER_DOMAIN: The base domain of the streaming provider for playing anime.
const WATCH_PROVIDER_DOMAIN = "miruro.ru";

// WATCH_PROVIDER_SEARCH_PATH: The search path query format used by the streaming provider.
const WATCH_PROVIDER_SEARCH_PATH = "/search?query=";

const SVG_ICONS = {
    star: `<svg class="svg-icon svg-icon-margin"><use href="#icon-star"></use></svg>`,
    play: `<svg class="svg-icon"><use href="#icon-play"></use></svg>`,
    chevronDown: `<svg class="accordion-icon svg-icon-large"><use href="#icon-chevron-down"></use></svg>`
};

/**
 * Renders the detailed anime page and its expandable item rows.
 * Linked to: `#detail-container` in `card.html`.
 */
export class DetailRenderer {
    /**
     * Builds the full detailed sidebar, item accordions, and status dropdowns for an anime group.
     * Restricts the global dropdown to watch statuses, and includes item-only release statuses.
     */
    static async renderDetail(container, anime, onItemStatusChange, onGlobalStatusChange, onRatingChange, onEpisodeToggle, onRatingClick = null, openItemIds = [], onItemRatingClick = null, minLoadStartTime = null) {
        const layout = container.querySelector('.anime-detail-layout-v3');
        if (!layout) return;

        // Set sidebar rating glow
        const sidebar = layout.querySelector('.anime-detail-sidebar-v3');
        const sidebarGlow = RatingManager.getCardClass(anime.rating);
        sidebar.className = `anime-detail-sidebar-v3 ${sidebarGlow}`.trim();

        // Populate poster
        const title = anime?.title || '';
        const initials = title.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '??';
        const hash = title.split('').reduce((acc, char) => char.charCodeAt(0) + acc, 0);
        const hue = hash % 360;

        const posterWrap = layout.querySelector('.sidebar-poster-wrap');
        const loaderHtml = `
            <div class="card-internal-loader">
                <svg width="32" height="32" viewBox="0 0 32 32" class="card-spinner-svg">
                    <circle cx="16" cy="16" r="12" class="card-spinner-circle" />
                </svg>
            </div>
        `;
        posterWrap.dataset.cardLoading = anime.coverImage ? 'true' : 'false';
        posterWrap.innerHTML = anime.coverImage
            ? `${loaderHtml}<img class="detail-poster" src="${anime.coverImage}" alt="${title} cover" loading="lazy" />`
            : `<div class="detail-poster-fallback" style="--poster-hue: ${hue};">${initials}</div>`;

        const detailImgEl = posterWrap.querySelector('.detail-poster');
        if (detailImgEl) {
            if (detailImgEl.complete) {
                posterWrap.dataset.cardLoading = 'false';
            } else {
                detailImgEl.onload = () => { posterWrap.dataset.cardLoading = 'false'; };
                detailImgEl.onerror = () => { posterWrap.dataset.cardLoading = 'false'; };
            }
        }

        // Title
        const sidebarTitle = layout.querySelector('.sidebar-title');
        sidebarTitle.textContent = title;

        // Global status select & ratings
        const gSelect = layout.querySelector('#global-status-select');
        const ratingsContainer = layout.querySelector('.sidebar-ratings-container');
        
        if (gSelect) {
            gSelect.value = anime.status;
            
            const newGSelect = gSelect.cloneNode(true);
            gSelect.parentNode.replaceChild(newGSelect, gSelect);
            newGSelect.addEventListener('change', (e) => {
                onGlobalStatusChange(anime, e.target.value);
            });
        }
        if (ratingsContainer) {
            const createSegmentsHtml = (score, isSmall = false) => {
                let html = `<div class="segmented-rating-bar${isSmall ? ' small' : ''}">`;
                const colors = [
                    '#e74c3c', '#e74c3c', '#e74c3c', '#e74c3c',
                    '#e67e22',
                    '#f1c40f',
                    '#a2d149',
                    '#2ecc71',
                    '#27ae60',
                    'linear-gradient(130deg, #ffe066 0%, #ffd700 50%, #b38f00 100%)'
                ];
                for (let i = 1; i <= 10; i++) {
                    const fillWidth = Math.min(100, Math.max(0, (score - (i - 1)) * 100));
                    const color = colors[i - 1];
                    const isGold = (i === 10);
                    const extraStyle = isGold ? 'box-shadow: 0 0 8px rgba(255, 215, 0, 0.7);' : '';
                    html += `
                        <div class="segment">
                            <div class="segment-fill" style="width: 0%; background: ${color}; ${extraStyle} transition: width 0.10s linear; transition-delay: ${(i - 1) * 0.10}s;" data-width="${fillWidth}%"></div>
                        </div>
                    `;
                }
                html += `</div>`;
                return html;
            };

            const getScoreColor = (score) => {
                if (!score || score === 0) return 'var(--nr-color)';
                if (score >= 9.0) return '#ffd700';
                if (score >= 8.0) return '#27ae60';
                if (score >= 7.0) return '#2ecc71';
                if (score >= 6.0) return '#a2d149';
                if (score >= 5.0) return '#f1c40f';
                if (score >= 4.0) return '#e67e22';
                return '#e74c3c';
            };

            const avgRating = anime.getAverageItemRating();
            const userScoreColor = getScoreColor(anime.rating);
            const avgScoreColor = getScoreColor(avgRating);

            const userRatingVal = layout.querySelector('.sidebar-rating-block.rating-actionable .sidebar-rating-val');
            if (userRatingVal) {
                userRatingVal.style.setProperty('--score-color', userScoreColor);
                userRatingVal.textContent = anime.rating > 0 ? anime.rating.toFixed(1) + '/10' : 'NR';
            }

            const userBarWrap = layout.querySelector('.user-segmented-bar');
            if (userBarWrap) {
                userBarWrap.innerHTML = createSegmentsHtml(anime.rating);
            }

            const avgRatingVal = layout.querySelector('.sidebar-rating-block:not(.rating-actionable) .sidebar-rating-val');
            if (avgRatingVal) {
                avgRatingVal.style.setProperty('--score-color', avgScoreColor);
                avgRatingVal.textContent = avgRating > 0 ? avgRating.toFixed(1) + '/10' : '—';
            }

            const avgBarWrap = layout.querySelector('.avg-segmented-bar');
            if (avgBarWrap) {
                avgBarWrap.innerHTML = createSegmentsHtml(avgRating, true);
            }

            const ratingBlock = layout.querySelector('.rating-actionable');
            if (ratingBlock) {
                const newRatingBlock = ratingBlock.cloneNode(true);
                ratingBlock.parentNode.replaceChild(newRatingBlock, ratingBlock);
                if (onRatingClick) {
                    newRatingBlock.addEventListener('click', (e) => {
                        e.stopPropagation();
                        onRatingClick(anime);
                    });
                }
            }
        }

        // Render Studio, Year, and Genres metadata
        const studioVal = layout.querySelector('#sidebar-studio-val');
        if (studioVal) {
            studioVal.textContent = anime.studio || '—';
        }

        const yearVal = layout.querySelector('#sidebar-year-val');
        if (yearVal) {
            yearVal.textContent = anime.year ? anime.year : '—';
        }

        const genresContainer = layout.querySelector('#sidebar-genres-container');
        if (genresContainer) {
            if (Array.isArray(anime.genres) && anime.genres.length > 0) {
                genresContainer.innerHTML = anime.genres.map(g => `<span class="genre-badge">${g}</span>`).join('');
                genresContainer.style.display = 'flex';
            } else {
                genresContainer.innerHTML = '';
                genresContainer.style.display = 'none';
            }
        }

        // Render episodes/accordion list
        const listDiv = layout.querySelector('.episodes-list-v3');
        if (listDiv) {
            if (minLoadStartTime) {
                const elapsed = Date.now() - minLoadStartTime;
                const remaining = Math.max(0, 500 - elapsed);
                if (remaining > 0) {
                    await new Promise(resolve => setTimeout(resolve, remaining));
                }
            }

            if (!container.isConnected) return;

            listDiv.innerHTML = '';
        }
        if (anime.items.length === 0) {
            const emptyP = document.createElement('p');
            emptyP.className = 'text-muted';
            emptyP.textContent = 'Geen episoden/seizoenen gevonden in deze groep.';
            listDiv.appendChild(emptyP);
        } else {
            const fragment = document.createDocumentFragment();
            anime.items.forEach((item, index) => {
                const isOpen = openItemIds.includes(item.id);
                const rowWrapper = document.createElement('details');
                rowWrapper.className = 'item-accordion-wrapper';
                rowWrapper.setAttribute('data-item-id', item.id);
                if (isOpen) {
                    rowWrapper.setAttribute('open', '');
                }
                
                const typeClass = `type-${(item.type || 'serie').toLowerCase()}`;
                const typeHtml = item.type ? `<span class="item-type-badge ${typeClass}">${item.type}</span>` : '';
                
                const rowHeader = document.createElement('summary');
                rowHeader.className = `detail-item-row ultimate-hover-effect ${item.status === 1 ? 'watched' : ''}`;
                rowHeader.dataset.watched = item.status === 1 ? 'true' : 'false';
                
                let itemStatusSelect = `
                    <select class="app-dropdown item-status-select ultimate-hover-effect" id="status-${item.id}">
                        <option value="3" ${item.status === 3 ? 'selected' : ''}>Airing</option>
                        <option value="2" ${item.status === 2 ? 'selected' : ''}>Upcoming</option>
                        <option value="-1" ${item.status === -1 ? 'selected' : ''}>Te Bekijken</option>
                        <option value="0" ${item.status === 0 ? 'selected' : ''}>Bezig</option>
                        <option value="1" ${item.status === 1 ? 'selected' : ''}>Bekeken</option>
                    </select>
                `;

                let searchTitle = item.title.replace(/(^|\s+)Season\s+\d+/i, '').replace(/(^|\s+)Cour\s+\d+/i, '').trim();
                if (!searchTitle) searchTitle = anime.title;
                let keyword = encodeURIComponent(searchTitle).replace(/%20/g, '+');
                let watchUrl = `https://${WATCH_PROVIDER_DOMAIN}${WATCH_PROVIDER_SEARCH_PATH}${keyword}`;

                let playBtn = `
                    <a href="${watchUrl}" target="_blank" class="item-play-btn status-btn-style ultimate-hover-effect" onclick="event.stopPropagation()" title="Zoek op ${WATCH_PROVIDER_DOMAIN}">
                        ${SVG_ICONS.play}
                    </a>
                `;

                const itemRatingTier = RatingManager.getBadgeClass(item.rating);
                let itemRatingBtn = `
                    <div class="rating-badge item-rating-badge ultimate-hover-effect r-${itemRatingTier}" data-rating-tier="${itemRatingTier}" title="Beoordeel dit item" data-item-id="${item.id}">
                        ${SVG_ICONS.star} 
                        <span>${item.rating > 0 ? item.rating.toFixed(1) : 'NR'}</span>
                    </div>
                `;

                rowHeader.innerHTML = `
                    ${SVG_ICONS.chevronDown}
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
                        e.preventDefault();
                        onItemRatingClick(item);
                    });
                }
                
                const itemSelect = rowHeader.querySelector('.item-status-select');
                itemSelect.addEventListener('click', e => e.stopPropagation());
                itemSelect.addEventListener('change', (e) => {
                    onItemStatusChange(item, e.target.value);
                });

                const playBtnElement = rowHeader.querySelector('.item-play-btn');
                if (playBtnElement) {
                    playBtnElement.addEventListener('click', e => e.stopPropagation());
                }
                
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
                
                rowWrapper.appendChild(rowHeader);
                rowWrapper.appendChild(episodesContainer);
                fragment.appendChild(rowWrapper);
            });
            listDiv.appendChild(fragment);
        }

        // Bind all custom dropdown components in detail view
        DropdownManager.bindAll(container);

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

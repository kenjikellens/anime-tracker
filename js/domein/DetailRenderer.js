import { RatingManager } from './RatingManager.js';
import { DropdownManager } from './DropdownManager.js';
import { escapeHtml } from './UIConstants.js';

// WATCH_PROVIDER_DOMAIN: The base domain of the streaming provider for playing anime.
const WATCH_PROVIDER_DOMAIN = "miruro.ru";

// WATCH_PROVIDER_SEARCH_PATH: The search path query format used by the streaming provider.
const WATCH_PROVIDER_SEARCH_PATH = "/search?query=";

const SVG_ICONS = {
    star: `<svg class="svg-icon svg-icon-margin" aria-hidden="true"><use href="#icon-star"></use></svg>`,
    play: `<svg class="svg-icon" aria-hidden="true"><use href="#icon-play"></use></svg>`,
    chevronDown: `<svg class="accordion-icon svg-icon-large" aria-hidden="true"><use href="#icon-chevron-down"></use></svg>`
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
    static async renderDetail(container, anime, onItemStatusChange, onGlobalStatusChange, onRatingChange, onEpisodeToggle, onRatingClick = null, openItemIds = [], onItemRatingClick = null, minLoadStartTime = null, onQueueToggle = null, onTimesWatchedChange = null) {
        const layout = container.querySelector('.anime-detail-layout-v3');
        if (!layout || !container.isConnected) return;

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
                <svg width="32" height="32" class="card-spinner-svg" aria-hidden="true">
                    <use href="#icon-spinner"></use>
                </svg>
            </div>
        `;
        posterWrap.dataset.cardLoading = anime.coverImage ? 'true' : 'false';
        posterWrap.innerHTML = anime.coverImage
            ? `${loaderHtml}<img class="detail-poster" src="${escapeHtml(anime.coverImage)}" alt="${escapeHtml(title)} cover" loading="lazy" />`
            : `<div class="detail-poster-fallback" style="--poster-hue: ${hue};" aria-hidden="true">${escapeHtml(initials)}</div>`;

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
            gSelect.value = String(anime.status);
            gSelect.onchange = (e) => {
                onGlobalStatusChange(anime, e.target.value);
            };
        }

        if (ratingsContainer) {
            const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
                    const fillRatio = Math.min(1, Math.max(0, score - (i - 1)));
                    const color = colors[i - 1];
                    const isGold = (i === 10);
                    const extraStyle = isGold ? 'box-shadow: 0 0 8px rgba(255, 215, 0, 0.7);' : '';
                    const delay = prefersReducedMotion ? '0s' : `${(i - 1) * 0.06}s`;
                    const initialScale = prefersReducedMotion ? fillRatio : 0;
                    html += `
                        <div class="segment">
                            <div class="segment-fill" style="background: ${color}; ${extraStyle} transform: scaleX(${initialScale}); transition-delay: ${delay};" data-scale="${fillRatio}"></div>
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
                ratingBlock.onclick = onRatingClick
                    ? (e) => {
                        e.stopPropagation();
                        onRatingClick(anime);
                    }
                    : null;
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
                genresContainer.innerHTML = anime.genres.map(g => `<span class="genre-badge">${escapeHtml(g)}</span>`).join('');
                genresContainer.classList.remove('hidden');
            } else {
                genresContainer.innerHTML = '';
                genresContainer.classList.add('hidden');
            }
        }

        // Render Times Watched metadata stepper
        const timesWatchedDisplay = layout.querySelector('#times-watched-display');
        const minusBtn = layout.querySelector('#times-watched-minus');
        const plusBtn = layout.querySelector('#times-watched-plus');

        if (timesWatchedDisplay) {
            timesWatchedDisplay.textContent = typeof anime.timesWatched === 'number' ? anime.timesWatched : 0;
        }

        if (minusBtn) {
            minusBtn.onclick = () => {
                const current = typeof anime.timesWatched === 'number' ? anime.timesWatched : 0;
                const next = Math.max(0, current - 1);
                anime.setTimesWatched(next);
                if (timesWatchedDisplay) timesWatchedDisplay.textContent = next;
                if (onTimesWatchedChange) onTimesWatchedChange(anime, next);
            };
        }

        if (plusBtn) {
            plusBtn.onclick = () => {
                const current = typeof anime.timesWatched === 'number' ? anime.timesWatched : 0;
                const next = current + 1;
                anime.setTimesWatched(next);
                if (timesWatchedDisplay) timesWatchedDisplay.textContent = next;
                if (onTimesWatchedChange) onTimesWatchedChange(anime, next);
            };
        }

        // Render episodes/accordion list immediately without artificial delay
        const listDiv = layout.querySelector('.episodes-list-v3');
        if (!listDiv) return;
        listDiv.innerHTML = '';

        if (anime.items.length === 0) {
            const emptyP = document.createElement('p');
            emptyP.className = 'text-muted';
            emptyP.dataset.empty = 'true';
            emptyP.textContent = 'Geen afleveringen of seizoenen gevonden in deze groep.';
            listDiv.appendChild(emptyP);
        } else {
            const fragment = document.createDocumentFragment();
            anime.items.forEach((item) => {
                const isOpen = openItemIds.includes(item.id);
                const rowWrapper = document.createElement('details');
                rowWrapper.className = 'item-accordion-wrapper';
                rowWrapper.setAttribute('data-item-id', item.id);
                if (isOpen) {
                    rowWrapper.setAttribute('open', '');
                }

                const rawType = (item.type || 'serie').toLowerCase().replace(/[^a-z0-9-]/g, '');
                const typeClass = `type-${rawType || 'serie'}`;
                const typeHtml = item.type ? `<span class="item-type-badge ${typeClass}">${escapeHtml(item.type)}</span>` : '';

                const rowHeader = document.createElement('summary');
                rowHeader.className = `detail-item-row ultimate-hover-effect ${item.status === 1 ? 'watched' : ''}`;
                rowHeader.dataset.watched = item.status === 1 ? 'true' : 'false';

                const itemStatusSelect = `
                    <select class="app-dropdown item-status-select ultimate-hover-effect" id="status-${escapeHtml(item.id)}" aria-label="Status voor ${escapeHtml(item.title)}">
                        <option value="3" ${item.status === 3 ? 'selected' : ''}>Airing</option>
                        <option value="2" ${item.status === 2 ? 'selected' : ''}>Upcoming</option>
                        <option value="-1" ${item.status === -1 ? 'selected' : ''}>Te Bekijken</option>
                        <option value="0" ${item.status === 0 ? 'selected' : ''}>Bezig</option>
                        <option value="4" ${item.status === 4 ? 'selected' : ''}>Verder Kijken</option>
                        <option value="1" ${item.status === 1 ? 'selected' : ''}>Bekeken</option>
                    </select>
                `;

                let searchTitle = item.title.replace(/(^|\s+)Season\s+\d+/i, '').replace(/(^|\s+)Cour\s+\d+/i, '').trim();
                if (!searchTitle) searchTitle = anime.title;
                const keyword = encodeURIComponent(searchTitle).replace(/%20/g, '+');
                const watchUrl = `https://${WATCH_PROVIDER_DOMAIN}${WATCH_PROVIDER_SEARCH_PATH}${keyword}`;

                const playBtn = `
                    <a href="${watchUrl}" target="_blank" rel="noopener noreferrer" class="item-play-btn status-btn-style ultimate-hover-effect" title="Zoek op ${WATCH_PROVIDER_DOMAIN}" aria-label="Zoek ${escapeHtml(item.title)} op ${WATCH_PROVIDER_DOMAIN}">
                        ${SVG_ICONS.play}
                    </a>
                `;

                const itemRatingTier = RatingManager.getBadgeClass(item.rating);
                const itemRatingBtn = `
                    <button type="button" class="rating-badge item-rating-badge ultimate-hover-effect r-${itemRatingTier}" data-rating-tier="${itemRatingTier}" title="Beoordeel dit onderdeel" aria-label="Beoordeel ${escapeHtml(item.title)}" data-item-id="${escapeHtml(item.id)}">
                        ${SVG_ICONS.star}
                        <span>${item.rating > 0 ? item.rating.toFixed(1) : 'NR'}</span>
                    </button>
                `;

                rowHeader.innerHTML = `
                    ${SVG_ICONS.chevronDown}
                    <div class="title-badge-group">
                        <div class="badge-area">${typeHtml}</div>
                        <div class="detail-item-title">${escapeHtml(item.title)}</div>
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
                    epDiv.className = 'episode-checkbox-wrap';

                    const safeDomId = String(item.id || '').replace(/[^a-zA-Z0-9_-]/g, '-');
                    const cb = document.createElement('input');
                    cb.type = 'checkbox';
                    cb.id = `ep-${safeDomId}-${i}`;
                    cb.dataset.ep = String(i);
                    cb.checked = isChecked;
                    cb.addEventListener('change', () => {
                        onEpisodeToggle(item, i);
                    });

                    const label = document.createElement('label');
                    label.htmlFor = cb.id;
                    label.textContent = `Aflevering ${i}`;

                    epDiv.appendChild(cb);
                    epDiv.appendChild(label);
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

        // Compositor-only transform animation for segmented rating bars
        requestAnimationFrame(() => {
            container.querySelectorAll('.segment-fill').forEach(fill => {
                const targetScale = fill.getAttribute('data-scale');
                if (targetScale !== null) {
                    fill.style.transform = `scaleX(${targetScale})`;
                }
            });
        });
    }
}

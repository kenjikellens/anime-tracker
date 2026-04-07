import { RatingManager } from './RatingManager.js';

export class DetailRenderer {
    static renderDetail(container, anime, onItemStatusChange, onGlobalStatusChange, onRatingChange, onEpisodeToggle, onRatingClick = null, openItemIds = []) {
        container.innerHTML = '';
        
        let globalStatusSelect = `
            <select class="status-current" id="global-status-select" style="height: 26px; padding: 0 8px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface-2); color: var(--text); font-weight: 600; font-size: 12px; cursor: pointer; outline: none;">
                <option value="-1" ${anime.status === -1 ? 'selected' : ''}>Te Bekijken</option>
                <option value="0" ${anime.status === 0 ? 'selected' : ''}>Bezig</option>
                <option value="1" ${anime.status === 1 ? 'selected' : ''}>Bekeken</option>
            </select>
        `;
        
        const title = anime?.title || '';
        const initials = title
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(w => w[0]?.toUpperCase() ?? '')
            .join('')
            .slice(0, 2) || '??';
        const hash = title.split('').reduce((acc, char) => char.charCodeAt(0) + acc, 0);
        const hue = hash % 360;

        const posterHtml = anime.coverImage
            ? `<img class="detail-poster" src="${anime.coverImage}" alt="${title} cover" loading="lazy" />`
            : `<div class="detail-poster-fallback" style="background: linear-gradient(135deg, hsl(${hue}, 60%, 45%), hsl(${(hue + 40) % 360}, 70%, 35%));">${initials}</div>`;

        const layout = document.createElement('div');
        layout.className = 'anime-detail-layout';

        const sidebar = document.createElement('div');
        sidebar.className = 'anime-detail-sidebar';
        sidebar.innerHTML = posterHtml;

        const main = document.createElement('div');
        main.className = 'anime-detail-main';

        const header = document.createElement('div');
        header.className = 'anime-detail-header';
        
        header.innerHTML = `
            <div class="anime-detail-content-col">
                <h2 class="anime-detail-title">${title}</h2>
                <div class="modal-global-actions anime-detail-actions">
                    <div class="rating-badge ${RatingManager.getBadgeClass(anime.rating)}" style="display: flex !important; align-items: center; gap: 6px; height: 26px; padding: 0 8px; flex-shrink: 0; white-space: nowrap; cursor: pointer;">
                        <i class="fas fa-star" style="font-size: 11px;"></i> 
                        <span style="font-weight: 800; font-size: 12px;">${anime.rating > 0 ? anime.rating.toFixed(1) : 'NR'}</span>
                    </div>
                    <div style="flex-shrink: 0;">${globalStatusSelect}</div>
                </div>
            </div>
        `;
        
        const ratingBadge = header.querySelector('.rating-badge');
        if (onRatingClick) {
            ratingBadge.addEventListener('click', (e) => {
                e.stopPropagation();
                onRatingClick(anime);
            });
        }
        
        const gSelect = header.querySelector('#global-status-select');
        gSelect.addEventListener('change', (e) => {
            onGlobalStatusChange(anime, e.target.value);
        });

        main.appendChild(header);
        
        const listDiv = document.createElement('div');
        listDiv.style.marginTop = "20px";
        
        if (anime.items.length === 0) {
            listDiv.innerHTML = '<p class="text-muted">Geen episoden/seizoenen gevonden in deze groep.</p>';
        } else {
            anime.items.forEach(item => {
                const isOpen = openItemIds.includes(item.id);
                const rowWrapper = document.createElement('div');
                rowWrapper.className = 'item-accordion-wrapper';
                rowWrapper.setAttribute('data-item-id', item.id);
                rowWrapper.style.cssText = 'border: 1px solid var(--border); border-radius: 8px; margin-bottom: 8px; overflow: hidden; background: var(--surface-2); transition: all 0.2s;';
                
                const typeHtml = item.type ? `<span class="item-type-badge">${item.type}</span>` : '';
                
                const rowHeader = document.createElement('div');
                rowHeader.className = `detail-item-row ${item.status === 1 ? 'watched' : ''}`;
                rowHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; cursor: pointer; border-bottom: none;';
                
                let itemStatusSelect = `
                    <select class="item-status-select" style="padding: 6px 10px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface); color: var(--text);">
                        <option value="-1" ${item.status === -1 ? 'selected' : ''}>Te Bekijken</option>
                        <option value="0" ${item.status === 0 ? 'selected' : ''}>Bezig</option>
                        <option value="1" ${item.status === 1 ? 'selected' : ''}>Bekeken</option>
                    </select>
                `;

                rowHeader.innerHTML = `
                    <div class="item-title-row" style="display:flex; align-items:center; gap:12px; flex:1;">
                        <i class="fas fa-chevron-down accordion-icon" style="transition: transform 0.3s; color: var(--text-muted); width: 14px; transform: ${isOpen ? 'rotate(-180deg)' : 'rotate(0deg)'};"></i>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            ${typeHtml}
                            <div class="detail-item-title" style="font-weight:700; font-size: 1.05rem;">${item.title}</div>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap: 8px;">
                        ${itemStatusSelect}
                    </div>
                `;
                
                // Allow select to work without triggering accordion
                const itemSelect = rowHeader.querySelector('.item-status-select');
                itemSelect.addEventListener('click', e => e.stopPropagation());
                itemSelect.addEventListener('change', (e) => {
                    onItemStatusChange(item, e.target.value);
                });
                
                const episodesContainer = document.createElement('div');
                episodesContainer.className = 'episodes-container';
                episodesContainer.style.cssText = `display: ${isOpen ? 'grid' : 'none'}; padding: 16px; border-top: 1px solid var(--border); background: var(--surface); grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 12px;`;
                
                const epCount = item.episodesCount || 12; // Fallback
                for (let i = 1; i <= epCount; i++) {
                    const isChecked = item.watchedEpisodes.includes(i) || item.status === 1;
                    const epDiv = document.createElement('div');
                    epDiv.className = "episode-checkbox-wrap";
                    epDiv.style.cssText = 'display: flex; align-items: center; gap: 8px;';
                    epDiv.innerHTML = `
                        <input type="checkbox" id="ep-${item.id}-${i}" data-ep="${i}" ${isChecked ? 'checked' : ''} style="accent-color: var(--primary); width: 16px; height: 16px; cursor: pointer;">
                        <label for="ep-${item.id}-${i}" style="color: var(--text-muted); font-size: 0.9rem; cursor: pointer; user-select: none;">Episode ${i}</label>
                    `;
                    
                    const cb = epDiv.querySelector('input');
                    cb.addEventListener('change', (e) => {
                        onEpisodeToggle(item, i);
                    });
                    
                    episodesContainer.appendChild(epDiv);
                }

                rowHeader.addEventListener('click', () => {
                    const icon = rowHeader.querySelector('.accordion-icon');
                    if (episodesContainer.style.display === 'none') {
                        episodesContainer.style.display = 'grid';
                        icon.style.transform = 'rotate(-180deg)';
                    } else {
                        episodesContainer.style.display = 'none';
                        icon.style.transform = 'rotate(0deg)';
                    }
                });
                
                rowWrapper.appendChild(rowHeader);
                rowWrapper.appendChild(episodesContainer);
                listDiv.appendChild(rowWrapper);
            });
        }

        main.appendChild(listDiv);

        layout.appendChild(sidebar);
        layout.appendChild(main);
        container.appendChild(layout);
    }
}

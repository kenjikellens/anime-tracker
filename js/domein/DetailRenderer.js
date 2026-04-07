import { RatingManager } from './RatingManager.js';

export class DetailRenderer {
    static renderDetail(container, anime, onItemStatusChange, onGlobalStatusChange, onRatingChange, onEpisodeToggle, onRatingClick = null, openItemIds = []) {
        container.innerHTML = '';
        
        let globalStatusSelect = `
            <select class="status-current detail-action-btn" id="global-status-select">
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
        layout.className = 'anime-detail-layout-v2';

        const topContainer = document.createElement('div');
        topContainer.className = 'anime-detail-top-container';

        const posterDiv = document.createElement('div');
        posterDiv.className = 'anime-detail-poster-wrap';
        posterDiv.innerHTML = posterHtml;

        const mainInfo = document.createElement('div');
        mainInfo.className = 'anime-detail-main-info';

        const headerTitle = document.createElement('h2');
        headerTitle.className = 'anime-detail-title-v2';
        headerTitle.textContent = title;

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'anime-detail-actions-v2';
        actionsDiv.innerHTML = `
            <div class="rating-badge detail-action-btn ${RatingManager.getBadgeClass(anime.rating)}">
                <i class="fas fa-star" style="font-size: 13px; margin-right: 6px;"></i> 
                <span>${anime.rating > 0 ? anime.rating.toFixed(1) : 'NR'}</span>
            </div>
            <div style="flex-shrink: 0;">${globalStatusSelect}</div>
        `;
        
        const ratingBadge = actionsDiv.querySelector('.rating-badge');
        if (onRatingClick) {
            ratingBadge.addEventListener('click', (e) => {
                e.stopPropagation();
                onRatingClick(anime);
            });
        }
        
        const gSelect = actionsDiv.querySelector('#global-status-select');
        gSelect.addEventListener('change', (e) => {
            onGlobalStatusChange(anime, e.target.value);
        });

        mainInfo.appendChild(headerTitle);
        mainInfo.appendChild(actionsDiv);

        topContainer.appendChild(posterDiv);
        topContainer.appendChild(mainInfo);

        layout.appendChild(topContainer);
        
        const listDiv = document.createElement('div');
        listDiv.style.marginTop = "20px";
        
        if (anime.items.length === 0) {
            listDiv.innerHTML = '<p class="text-muted">Geen episoden/seizoenen gevonden in deze groep.</p>';
        } else {
            anime.items.forEach(item => {
                const isOpen = openItemIds.includes(item.id);
                const rowWrapper = document.createElement('div');
                rowWrapper.className = `item-accordion-wrapper ${isOpen ? 'is-open' : ''}`;
                rowWrapper.setAttribute('data-item-id', item.id);
                // We verwijderen de inline border/margin/background om conflicten met CSS te voorkomen
                rowWrapper.style.cssText = 'margin-bottom: 12px; overflow: hidden; transition: all 0.3s;';
                
                const typeClass = `type-${(item.type || 'serie').toLowerCase()}`;
                const typeHtml = item.type ? `<span class="item-type-badge ${typeClass}">${item.type}</span>` : '';
                
                const rowHeader = document.createElement('div');
                rowHeader.className = `detail-item-row ${item.status === 1 ? 'watched' : ''}`;
                rowHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 8px 16px; cursor: pointer; position: relative; gap: 12px;';
                
                let itemStatusSelect = `
                    <select class="item-status-select" id="status-${item.id}">
                        <option value="-1" ${item.status === -1 ? 'selected' : ''}>Te Bekijken</option>
                        <option value="0" ${item.status === 0 ? 'selected' : ''}>Bezig</option>
                        <option value="1" ${item.status === 1 ? 'selected' : ''}>Bekeken</option>
                    </select>
                `;

                rowHeader.innerHTML = `
                    <i class="fas fa-chevron-down accordion-icon" style="transition: transform 0.3s; color: var(--text-muted); width: 14px; transform: ${isOpen ? 'rotate(-180deg)' : 'rotate(0deg)'};"></i>
                    <div class="title-badge-group" style="display: flex; flex-direction: column; justify-content: center; gap: 2px; flex: 1;">
                        <div class="badge-area" style="line-height: 1;">${typeHtml}</div>
                        <div class="detail-item-title" style="font-weight:700; font-size: 1rem; color: var(--white);">${item.title}</div>
                    </div>
                    ${itemStatusSelect}
                `;
                
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
                    const isOpening = !rowWrapper.classList.contains('is-open');
                    
                    rowWrapper.classList.toggle('is-open');
                    
                    if (isOpening) {
                        icon.style.transform = 'rotate(-180deg)';
                    } else {
                        icon.style.transform = 'rotate(0deg)';
                    }
                });
                
                rowWrapper.appendChild(rowHeader);
                rowWrapper.appendChild(episodesContainer);
                listDiv.appendChild(rowWrapper);
            });
        }

        layout.appendChild(listDiv);
        container.appendChild(layout);
    }
}

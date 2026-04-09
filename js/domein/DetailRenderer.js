import { RatingManager } from './RatingManager.js';

export class DetailRenderer {
    static renderDetail(container, anime, onItemStatusChange, onGlobalStatusChange, onRatingChange, onEpisodeToggle, onRatingClick = null, openItemIds = []) {
        container.innerHTML = '';
        
        let globalStatusSelect = `
            <select class="status-current detail-action-btn" id="global-status-select" style="width: 100%;">
                <option value="2" ${anime.status === 2 ? 'selected' : ''}>Nieuw</option>
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
        sidebar.className = 'anime-detail-sidebar-v3';

        const posterWrap = document.createElement('div');
        posterWrap.className = 'sidebar-poster-wrap';
        posterWrap.innerHTML = posterHtml;

        const sidebarInfo = document.createElement('div');
        sidebarInfo.className = 'sidebar-info';

        const sidebarTitle = document.createElement('h2');
        sidebarTitle.className = 'sidebar-title';
        sidebarTitle.textContent = title;

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'sidebar-actions';
        actionsDiv.innerHTML = `
            <div class="rating-badge detail-action-btn ${RatingManager.getBadgeClass(anime.rating)}">
                <i class="fas fa-star"></i> 
                <span>${anime.rating > 0 ? anime.rating.toFixed(1) : 'NR'}</span>
            </div>
            ${globalStatusSelect}
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

                let searchTitle = item.title.replace(/\s+Season\s+\d+/i, '').replace(/\s+Cour\s+\d+/i, '').trim();
                let keyword = encodeURIComponent(searchTitle).replace(/%20/g, '+');
                let anikaiUrl = `https://anikai.to/browser?keyword=${keyword}`;

                let playBtn = `
                    <a href="${anikaiUrl}" target="_blank" class="item-play-btn" onclick="event.stopPropagation()" title="Zoek op Anikai">
                        <i class="fas fa-play"></i>
                    </a>
                `;

                rowHeader.innerHTML = `
                    <i class="fas fa-chevron-down accordion-icon" style="transform: ${isOpen ? 'rotate(-180deg)' : 'rotate(0deg)'};"></i>
                    <div class="title-badge-group">
                        <div class="badge-area">${typeHtml}</div>
                        <div class="detail-item-title">${item.title}</div>
                    </div>
                    <div class="item-actions-group">
                        ${itemStatusSelect}
                        ${playBtn}
                    </div>
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
    }
}

// domein/BatchActions.js
window.BatchActions = (function() {

    /**
     * Toont of verbergt de zwevende batch-actiebalk.
     * @param {number} x - Horizontale muispositie
     * @param {number} y - Verticale muispositie
     */
    function renderBatchBar(x, y) {
        let bar = document.getElementById('batch-bar');
        if (selectedEpisodes.size === 0) {
            if (bar) bar.remove();
            return;
        }

        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'batch-bar';
            bar.className = 'batch-bar';
            document.body.appendChild(bar);
        }

        bar.style.left = `${Math.min(window.innerWidth - 220, x + 15)}px`;
        bar.style.top = `${Math.min(window.innerHeight - 150, y + 15)}px`;

        bar.innerHTML = `
            <div class="batch-header">
                <span><b>${selectedEpisodes.size}</b> geselecteerd</span>
                <button class="batch-close" onclick="BatchActions.clearSelection()">&times;</button>
            </div>
            <div class="batch-options">
                <button onclick="BatchActions.applyBatchStatus(1)"><i class="fas fa-check"></i> Bekeken</button>
                <button onclick="BatchActions.applyBatchStatus(0)"><i class="fas fa-play"></i> Bezig</button>
                <button onclick="BatchActions.applyBatchStatus(-1)"><i class="fas fa-clock"></i> Te Bekijken</button>
            </div>
        `;
    }

    /** Wist de huidige selectie van afleveringen. */
    function clearSelection() {
        selectedEpisodes.clear();
        renderBatchBar();
        document.querySelectorAll('.episode-row.selected').forEach(r => r.classList.remove('selected'));
        if (typeof render === 'function') render();
    }

    /** Past een status toe op alle geselecteerde afleveringen. */
    function applyBatchStatus(status) {
        if (selectedEpisodes.size === 0) return;
        
        selectedEpisodes.forEach(({ item, season, episode }) => {
            episode.status = parseInt(status);
        });
        
        save();
        if (typeof currentlyShownItem !== 'undefined' && currentlyShownItem) {
            if (typeof showDetailModal === 'function') showDetailModal(currentlyShownItem);
        }
        clearSelection();
    }

    return {
        renderBatchBar,
        clearSelection,
        applyBatchStatus
    };
})();

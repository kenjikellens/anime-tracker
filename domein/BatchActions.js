// domein/BatchActions.js
window.BatchActions = (function() {

    /**
     * Maakt een batchactieknop.
     *
     * @param {string} iconClass
     * @param {string} label
     * @param {number} status
     * @returns {HTMLButtonElement}
     */
    function createBatchButton(iconClass, label, status) {
        const button = document.createElement('button');
        button.innerHTML = `<i class="${iconClass}"></i> ${label}`;
        button.addEventListener('click', () => applyBatchStatus(status));
        return button;
    }

    /**
     * Toont of verbergt de zwevende batch-actiebalk.
     *
     * @param {number} [x=16]
     * @param {number} [y=16]
     * @returns {void}
     */
    function renderBatchBar(x = 16, y = 16) {
        let bar = document.getElementById('batch-bar');

        if (selectedEpisodes.size === 0) {
            if (bar) {
                bar.remove();
            }
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
        bar.innerHTML = '';

        const header = document.createElement('div');
        header.className = 'batch-header';
        header.innerHTML = `<span><b>${selectedEpisodes.size}</b> geselecteerd</span>`;

        const closeButton = document.createElement('button');
        closeButton.className = 'batch-close';
        closeButton.innerHTML = '&times;';
        closeButton.addEventListener('click', clearSelection);
        header.appendChild(closeButton);

        const options = document.createElement('div');
        options.className = 'batch-options';
        options.appendChild(createBatchButton('fas fa-check', 'Bekeken', 1));
        options.appendChild(createBatchButton('fas fa-play', 'Bezig', 0));
        options.appendChild(createBatchButton('fas fa-clock', 'Te Bekijken', -1));

        bar.appendChild(header);
        bar.appendChild(options);
    }

    /**
     * Wist de huidige selectie van afleveringen.
     *
     * @returns {void}
     */
    function clearSelection() {
        selectedEpisodes.clear();
        renderBatchBar();
        document.querySelectorAll('.episode-row.selected').forEach((row) => row.classList.remove('selected'));
        if (typeof render === 'function') {
            render();
        }
    }

    /**
     * Past een status toe op alle geselecteerde afleveringen.
     *
     * @param {number} status
     * @returns {void}
     */
    function applyBatchStatus(status) {
        if (selectedEpisodes.size === 0) {
            return;
        }

        selectedEpisodes.forEach(({ episode }) => {
            episode.status = Number.parseInt(status, 10);
        });

        save();

        if (window.currentlyShownItem && window.Modals && typeof window.Modals.showDetailModal === 'function') {
            window.Modals.showDetailModal(window.currentlyShownItem);
        }

        clearSelection();
    }

    return {
        renderBatchBar,
        clearSelection,
        applyBatchStatus
    };
})();

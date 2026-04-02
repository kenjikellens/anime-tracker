// domein/Modals.js
window.Modals = (function() {

    let currentItem = null;
    let ratingChangeStatus = false;

    /**
     * Opent de beoordelingsmodal voor het gegeven anime-item.
     * @param {Object} item - Het item dat beoordeeld wordt
     * @param {boolean} [changeStatus=true] - Als true wordt de status ook op 'Bekeken' gezet bij opslaan
     */
    function showRatingModal(item, changeStatus = true) {
        currentItem = item;
        ratingChangeStatus = changeStatus;
        document.getElementById('modal-title').textContent = item.title;
        document.getElementById('rating-number').value = (item.rating !== undefined && item.rating > -1) ? item.rating.toFixed(1) : '7.0';
        document.getElementById('modal-overlay').classList.remove('hidden');
    }

    /**
     * Opent de detail-modal voor een franchise-groep.
     * @param {Object} group - Franchise-groepsobject
     */
    function showDetailModal(group) {
        window.currentlyShownItem = group;
        const titleEl = document.getElementById('detail-title');
        titleEl.innerHTML = `<span>${group.title}</span>`;
        
        const topDd = Components.buildStatusDropdown(group._computedStatus, (newStatus) => {
            group.items.forEach(item => setAnimeAllStatus(item, newStatus));
            save(); render();
            showDetailModal(group);
        });
        topDd.style.marginLeft = '15px';
        titleEl.appendChild(topDd);

        const content = document.getElementById('detail-content');
        content.innerHTML = '';
        content.appendChild(Components.buildDetailGroup(group));

        document.getElementById('detail-overlay').classList.remove('hidden');
    }

    function initEventListeners() {
        document.getElementById('cancel-rating').addEventListener('click', () => {
            document.getElementById('modal-overlay').classList.add('hidden');
        });

        document.getElementById('save-rating').addEventListener('click', () => {
            const raw = parseFloat(document.getElementById('rating-number').value);
            const clamped = Math.min(10, Math.max(0, raw));
            currentItem.rating = Math.round(clamped * 10) / 10;
            if (ratingChangeStatus) setAnimeAllStatus(currentItem, 1);
            save(); render();
            document.getElementById('modal-overlay').classList.add('hidden');
        });

        document.getElementById('clear-rating').addEventListener('click', () => {
            currentItem.rating = -1;
            save(); render();
            document.getElementById('modal-overlay').classList.add('hidden');
        });

        document.getElementById('close-detail').addEventListener('click', () => {
            window.currentlyShownItem = null;
            document.getElementById('detail-overlay').classList.add('hidden');
        });

        document.getElementById('detail-overlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                window.currentlyShownItem = null;
                document.getElementById('detail-overlay').classList.add('hidden');
            }
        });
    }

    return {
        showRatingModal,
        showDetailModal,
        initEventListeners
    };
})();

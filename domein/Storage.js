// domein/Storage.js

/**
 * Zet de downloadknop in de juiste visuele toestand.
 * Op GitHub Pages toont deze knop een exporteerfunctie.
 *
 * @param {boolean} isDirty
 * @returns {void}
 */
function updateDownloadButtonState(isDirty) {
    const downloadButton = document.getElementById('download-btn');
    if (!downloadButton) {
        return;
    }

    downloadButton.classList.toggle('hidden', !isGitHub);
    downloadButton.classList.toggle('sync-needed', Boolean(isDirty));
}

/**
 * Slaat UI-voorkeuren op in localStorage.
 * Data-mutaties gaan direct naar AniList via triggerAutoSync().
 * Er is geen lokale data.json opslag meer.
 *
 * @async
 * @returns {Promise<void>}
 */
async function save() {
    // Alleen UI-state opslaan in localStorage
    try {
        localStorage.setItem('rascal_filters', JSON.stringify([...activeFilters]));
        localStorage.setItem('rascal_sort', currentSort);
        localStorage.setItem('rascal_view', currentView);
        localStorage.setItem('rascal_size', currentSize);
    } catch (error) {
        console.warn('[Storage] localStorage opslaan mislukt:', error);
    }
}

/**
 * Exporteert de runtime-lijst als JSON backup.
 *
 * @returns {void}
 */
function exportData() {
    if (!document.body) {
        console.warn('[Storage] Kan niet exporteren zonder document.body.');
        return;
    }

    const dataString = JSON.stringify(state.animeList, null, 2);
    const blob = new Blob([dataString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'rascal_backup.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

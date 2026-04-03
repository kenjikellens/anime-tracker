// domein/Storage.js

/**
 * Zet de downloadknop in de juiste visuele toestand.
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
 * Slaat de huidige applicatiestatus op in localStorage of via de backend.
 *
 * @async
 * @returns {Promise<void>}
 */
async function save() {
    try {
        if (isGitHub) {
            localStorage.setItem('rascal_data', JSON.stringify(state.animeList));
            updateDownloadButtonState(true);
            console.log('Opgeslagen in localStorage (GitHub mode)');
            return;
        }

        const response = await fetch('/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(state.animeList, null, 2)
        });

        if (!response.ok) {
            throw new Error(`Opslaan mislukt (${response.status} ${response.statusText})`);
        }
    } catch (error) {
        console.error('Opslaan mislukt:', error);
    }
}

/**
 * Exporteert de lokale browserdata als `data.json`.
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
    link.download = 'data.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    updateDownloadButtonState(false);
}

// domein/Storage.js

/**
 * Slaat de huidige applicatiestatus (`state.animeList`) op in de juiste omgeving.
 * 
 * Gedrag is afhankelijk van de uitvoeringsmodus:
 * - **GitHub-modus (`isGitHub`)**: Wordt opgeslagen in `localStorage` om dataverlies binnen het bezochte systeem 
 *   te voorkomen. Verandert vervolgens visueel de download-knop zodat men weet dat een handmatige export nodig is.
 * - **Lokale modus (Python backend)**: Stuurt de data via een POST-request naar `http://localhost:port/save`, 
 *   waar de backend de wijzigingen op de harde schijf in `data.json` wegschrijft.
 * 
 * @async
 * @function save
 * @returns {Promise<void>} Retouneert leeg bij voltooiing, print eventuele serverfouten.
 */
async function save() {
    try {
        if (isGitHub) {
            localStorage.setItem('rascal_data', JSON.stringify(state.animeList));
            const dlBtn = document.getElementById('download-btn');
            if (dlBtn) {
                dlBtn.classList.remove('hidden');
                dlBtn.classList.add('sync-needed');
            }
            console.log('Opgeslagen in localStorage (GitHub mode)');
        } else {
            await fetch('/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(state.animeList, null, 2)
            });
        }
    } catch (e) {
        console.error('Opslaan mislukt:', e);
    }
}

/**
 * Exporteert de lokale browserdata (JavaScript `state.animeList`) als een daadwerkelijk `data.json` bestand.
 * 
 * Werking:
 * - Creëert een tijdelijke Blob van de JSON-data in het geheugen.
 * - Injecteert en klikt op een virtuele `<a>` download-link binnen de DOM in de browser.
 * - Verwijdert onmiddellijk de link na uitvoering en stopt de waarschuwingspuls op de download-knop
 *   (aangezien de gebruiker handmatig de wijziging heeft veiliggesteld).
 * 
 * @function exportData
 * @returns {void}
 */
function exportData() {
    const dataStr = JSON.stringify(state.animeList, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'data.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    const dlBtn = document.getElementById('download-btn');
    if (dlBtn) {
        dlBtn.classList.remove('sync-needed');
    }
}

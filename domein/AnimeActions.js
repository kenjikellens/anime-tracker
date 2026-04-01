// domein/AnimeActions.js
// Dit bestand bevat pure domein logica voor het muteren van statussen (veilig!).

window.AnimeActions = (function() {

    /**
     * Stelt de status van een individuele aflevering in.
     * De top-level franchise/serie status wordt niet hier ingesteld, maar wordt 
     * on-the-fly herberekend in de StatusCalculator.
     * 
     * @param {Object} item - Het betreffende anime serie object.
     * @param {Object} season - Het doelseizoen object.
     * @param {Object} episode - De doelspecifieke aflevering om te muteren.
     * @param {number} newStatus - De nieuw te geven status (-1, 0, of 1).
     */
    function setEpisodeStatusLocally(item, season, episode, newStatus) {
        episode.status = newStatus;
        // Status wordt on-the-fly berekend door StatusCalculator — geen item.status meer schrijven
    }

    /**
     * Mutator om in één actie de voortgangsstatus van een geheel seizoensblok aan te passen.
     * 
     * Specifiek gedrag op basis van input:
     * - Status **1 (Bekeken)** of **-1 (Te Bekijken)**: Overrides de status van *alle* afleveringen 
     *   binnenin dit seizoen naar deze nieuwe target status.
     * - Status **0 (Bezig)**: Zoekt dynamisch naar de *eerste* onbekeken aflevering binnen 
     *   dit seizoen en markeert uitsluitend dié specifieke aflevering als 'Bezig'.
     * 
     * @param {Object} item - Het betreffende anime serie object.
     * @param {Object} season - Het doelseizoen dat veranderd wordt.
     * @param {number} newStatus - De gekozen status (-1, 0, 1).
     */
    function setSeasonStatusLocally(item, season, newStatus) {
        if (newStatus === 1 || newStatus === -1) {
            // Actie A of C: Alle afleveringen in dit seizoen worden de nieuwe status.
            season.episodes.forEach(ep => ep.status = newStatus);
        } else if (newStatus === 0) {
            // Actie B: We scannen het betreffende seizoen op de EERSTE aflevering die NIET 'Bekeken' (1) is.
            // Die zetten we op 'Bezig' (0). De rest blijft af.
            const firstUnwatched = season.episodes.find(ep => ep.status !== 1);
            if (firstUnwatched) {
                firstUnwatched.status = 0;
            }
        }
        // Status wordt on-the-fly berekend — geen item.status meer schrijven
    }

    /**
     * Hoofd-mutator om de status van een complete serie of film in één keer te veranderen.
     * Werkt over de grenzen van seizoenen heen voor series.
     * 
     * @param {Object} item - Franchise of serie/film object uit de database.
     * @param {number} newStatus - De resulterende status (-1, 0, 1).
     */
    function setAnimeStatusLocally(item, newStatus) {
        if (!item.seasons || item.seasons.length === 0) {
            // Film of item zonder seizoendata
            if (item.type === 'movie') {
                item.status = newStatus;
            }
            return;
        }

        if (newStatus === 1 || newStatus === -1) {
            // Actie A of C: Alle afleveringen van alle seizoenen de nieuwe status.
            item.seasons.forEach(s => {
                s.episodes.forEach(ep => ep.status = newStatus);
            });
        } else if (newStatus === 0) {
            // Actie B: Zelfde als bij seizoen, maar globaal over alle seizoenen heen de allereerste open episode opsporen.
            let found = false;
            for (const s of item.seasons) {
                const firstUnwatched = s.episodes.find(ep => ep.status !== 1);
                if (firstUnwatched) {
                    firstUnwatched.status = 0;
                    found = true;
                    break;
                }
            }
            if (!found) {
                // Eventuele absolute grensgeval: alles was 1, maar gebruiker forceert 0? 
                // Dan kan er geen element gevonden worden; we doen er niets mee.
            }
        }
        // Status wordt on-the-fly berekend — geen item.status meer schrijven
    }

    return {
        setEpisodeStatusLocally,
        setSeasonStatusLocally,
        setAnimeStatusLocally
    };
})();

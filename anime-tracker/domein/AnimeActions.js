// domein/AnimeActions.js
// Dit bestand bevat pure domein logica voor het muteren van statussen (veilig!).

window.AnimeActions = (function() {

    function setEpisodeStatusLocally(item, season, episode, newStatus) {
        episode.status = newStatus;
        // Status wordt on-the-fly berekend door StatusCalculator — geen item.status meer schrijven
    }

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

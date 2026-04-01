// domein/StatusCalculator.js
// Dit bestand bevat pure domein logica voor het berekenen van statussen.

window.StatusCalculator = (function () {

    function getSeasonStatus(season) {
        if (!season.episodes || season.episodes.length === 0) return null; // Leeg / nog niet uitgekomen

        // GOUDEN REGEL check voor seizoen
        if (season.episodes.every(e => e.status === 1)) return 1;
        if (season.episodes.some(e => e.status === 0 || e.status === 1)) return 0;

        return -1;
    }

    function getAnimeStatus(item) {
        if (item.type === 'movie') {
            const s = (item.status !== undefined && item.status !== -1) ? item.status : (item._legacyStatus !== undefined ? item._legacyStatus : -1);
            return Number(s);
        }

        // Legacy fallback als er nog geen seizoendata is
        if (!item.seasons || item.seasons.length === 0) {
            return item._legacyStatus !== undefined ? Number(item._legacyStatus) : -1;
        }


        const allEps = item.seasons.flatMap(s => s.episodes);
        if (allEps.length === 0) {
            return item._legacyStatus !== undefined ? Number(item._legacyStatus) : -1;
        }

        // GOUDEN REGEL: Als alle beschikbare afleveringen bekeken zijn: 1
        if (allEps.every(e => e.status === 1)) return 1;

        // Check voor "Nieuw Seizoen (2)"
        // We berekenen de statussen van alle NIET-LEGE seizoenen
        const activeSeasonStatuses = item.seasons
            .map(s => getSeasonStatus(s))
            .filter(s => s !== null); // Filter lege seizoenen eruit

        const hasWatchedSeason = activeSeasonStatuses.some(s => s === 1);
        const hasUnwatchedSeason = activeSeasonStatuses.some(s => s === -1);
        const hasActiveSeason = activeSeasonStatuses.some(s => s === 0);
        const hasActiveEpisode = allEps.some(e => e.status === 0);

        if (hasWatchedSeason && hasUnwatchedSeason && !hasActiveEpisode && !hasActiveSeason) {
            return 2; // Nieuw Seizoen!
        }

        // Als het geen 1 is en geen 2 is, is het dan "Te Bekijken" (-1) of "Bezig" (0)?
        if (allEps.every(e => e.status === -1)) return -1;

        return 0; // Bezig
    }

    return {
        getSeasonStatus,
        getAnimeStatus
    };
})();

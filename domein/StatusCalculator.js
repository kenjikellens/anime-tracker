// domein/StatusCalculator.js
// Dit bestand bevat pure domein logica voor het berekenen van statussen.

window.StatusCalculator = (function () {

    /**
     * Berekent in real-time de "gecombineerde" status van een specifieke seizoenarray (`season.episodes`).
     * De gouden regel: 
     * - Als je alle episodes gezien hebt: "Bekeken" (1).
     * - Als ook maar één aflevering "Bekeken" (1) of "Bezig" (0) is: "Bezig" (0).
     * - Voor al het overige: "Te Bekijken" (-1).
     * 
     * @param {Object} season - Seizoenselement bevat een `episodes` array.
     * @returns {number|null} De herberekende status, of null indien er geen afleveringsdata is.
     */
    function getSeasonStatus(season) {
        if (!season.episodes || season.episodes.length === 0) return null; // Leeg / nog niet uitgekomen

        // GOUDEN REGEL check voor seizoen
        if (season.episodes.every(e => e.status === 1)) return 1;
        if (season.episodes.some(e => e.status === 0 || e.status === 1)) return 0;

        return -1;
    }

    /**
     * Berekent iteratief over alle aanwezige seizoenen van de show the all-round animestatus.
     * Een show is pas écht "Bekeken" als IEDERE aflevering van IEDER seizoen status 1 is.
     * Valt (indien seizoenen nog niet zijn gesynct) organisch terug op the raw properties .status of ._legacyStatus.
     * 
     * @param {Object} item - Het anime data object.
     * @returns {number} De macro-status voor the franchise.
     */
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

        // Als alle afleveringen bekeken zijn: Bekeken (1)
        if (allEps.every(e => e.status === 1)) return 1;

        // Te Bekijken (-1) als niemand begonnen is
        if (allEps.every(e => e.status === -1)) return -1;

        return 0; // Bezig
    }

    return {
        getSeasonStatus,
        getAnimeStatus
    };
})();

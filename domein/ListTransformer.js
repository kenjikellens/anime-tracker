// domein/ListTransformer.js

/**
 * De ultieme data-verwerking functie die over de gehele UI regeert. Deze functie neemt
 * de ruwe array content uit `state.animeList` en past hiermee de complexe user-interface regels toe.
 * 
 * Volgorde van executie:
 * 1. Mapt (groepeert) alle ingangen op "franchise" titel (zodat vervolgen/spin-offs getoond kunnen worden onder 1 kaart).
 * 2. Berekent de gecombineerde status (Te Bekijken / Bezig / Bekeken) en de maximale gebruikersrating.
 * 3. Filtert de resultaten afhankelijk van welke status-filters `activeFilters` momenteel dragen.
 * 4. Filtert (met auto-opschoning van vreemde karakters) op de globale iteratieve text-zoekbewerking `currentSearch`.
 * 5. Sorteert de resulterende weergavelijst in de laatstgevraagde parameter `currentSort` (titel, datum, rating).
 * 
 * @function getFilteredSorted
 * @returns {Array<Object>} Getransformeerde lijst van applicatieklare franchise-groepsobjecten voor display/rendering.
 */
function getFilteredSorted() {
    let list = state.animeList.map(group => {
        // Zorg dat we essentiële metadata hebben voor de weergave
        const itemWithPoster = group.items.find(i => i.poster_path) || group.items[0];
        group.poster_path = itemWithPoster?.poster_path;
        group.tmdb_id = itemWithPoster?.tmdb_id;

        // Bereken gezamenlijke status van de franchise: 0 (Bezig) > -1 (Te Bekijken) > 1 (Bekeken)
        const statuses = group.items.map(item => window.StatusCalculator.getAnimeStatus(item));
        if (statuses.includes(0)) group._computedStatus = 0;
        else if (statuses.includes(-1)) group._computedStatus = -1;
        else group._computedStatus = 1;

        // Franchise rating is de hoogste rating van alle onderliggende items
        group.rating = Math.max(...group.items.map(i => i.rating || -1));

        return group;
    });

    // Filter op actieve statussen (Te Bekijken, Bezig, Bekeken)
    list = list.filter(a => activeFilters.has(a._computedStatus));

    // Iteratieve tekst-zoekopdracht
    if (currentSearch) {
        const normalize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const s = normalize(currentSearch);
        list = list.filter(a => normalize(a.name).includes(s));
    }

    // Sortering
    switch (currentSort) {
        case 'title-asc': list.sort((a, b) => a.name.localeCompare(b.name)); break;
        case 'title-desc': list.sort((a, b) => b.name.localeCompare(a.name)); break;
        case 'rating-desc': list.sort((a, b) => (b.rating > -1 ? b.rating : -2) - (a.rating > -1 ? a.rating : -2)); break;
        case 'rating-asc': list.sort((a, b) => (a.rating > -1 ? a.rating : -2) - (b.rating > -1 ? b.rating : -2)); break;
        case 'status': list.sort((a, b) => a._computedStatus - b._computedStatus); break;
    }
    return list;
}

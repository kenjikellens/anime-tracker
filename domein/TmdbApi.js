// domein/TmdbApi.js

/**
 * Itereert over de huidige `state.animeList` en haalt asynchroon TMDB-posters op 
 * voor alle items (zowel films als series) die nog geen `poster_path` gedefinieerd hebben.
 * Wordt meestal op de achtergrond gestart ter bevordering van the "lazy loading" UX.
 * 
 * @async
 * @function lazyFetchPosters
 * @returns {Promise<void>} Blokkeert niet; haalt posters één voor één op via `fetchTmdbId`.
 */
async function lazyFetchPosters() {
    for (const item of state.animeList) {
        if (!item.poster_path) {
            await fetchTmdbId(item);
        }
    }
}

/**
 * Itereert over alle series in de `state.animeList` en synchroniseert asynchroon 
 * de meest recente seizoendata via TMDB. Zorgt ervoor dat nieuwe afleveringen automatisch
 * worden gedetecteerd wekelijks. Overslaat handmatig gemarkeerde seizoenen en films.
 * Triggert een view-render indien de berekende totaalstatus (uitgevloeid vanuit
 * nieuwe/vervallen afleveringen) gewijzigd is.
 * 
 * @async
 * @function lazySyncSeasons
 * @returns {Promise<void>} 
 */
async function lazySyncSeasons() {
    for (const item of state.animeList) {
        if (item.type === 'movie') continue;
        if (item.manual_seasons) continue;
        if (!item.tmdb_id) continue;

        const oldStatus = window.StatusCalculator.getAnimeStatus(item);
        await fetchSeasonData(item);
        const newStatus = window.StatusCalculator.getAnimeStatus(item);
        if (oldStatus !== newStatus) {
            console.log(`[Sync] ${item.title}: status ${oldStatus} → ${newStatus}`);
            if (typeof render === 'function') render();
        }
    }
}

/**
 * Gebruikt de The Movie Database (TMDB) API `/search/multi` route om de `tmdb_id`, 
 * het mediatype ('movie' of 'tv'), de poster en de originele releasedatum van een anime op te zoeken 
 * op basis van zijn algemene titel in the watchlist.
 * Als de API met success iets vindt, muteert de array parameter en roept `save()` aan.
 * 
 * @async
 * @function fetchTmdbId
 * @param {Object} item - Een object representatie van de anime uit de `state.animeList`.
 * @returns {Promise<{ id: number, type: string }|null>} Het specifieke theMovieDb object meta, of null bij een failure/null resultaat.
 */
async function fetchTmdbId(item) {
    if (item.tmdb_id && item.poster_path) return { id: item.tmdb_id, type: item.type };
    try {
        const res = await fetch(
            `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(item.title)}&language=en-US`
        );
        const data = await res.json();
        if (data.results && data.results.length > 0) {
            const best = data.results[0];
            item.tmdb_id = best.id;
            item.type = best.media_type === 'movie' ? 'movie' : 'tv';
            item.poster_path = best.poster_path;
            item.release_date = best.release_date || best.first_air_date;
            save();
            return { id: best.id, type: item.type };
        }
        return null;
    } catch (e) {
        console.error('TMDB fetch error:', e);
        return null;
    }
}

/**
 * Haalt de specifieke seizoenen én de per-seizoen afleveringslijsten (episodes) op
 * via the TMDB server (`/tv/{id}` en `/tv/{id}/season/{s}`). 
 * Het meest cruciale onderdeel van deze methode is het behouden van de gebruikersstatus. 
 * Wanneer afleveringen (bijv. als "Bekeken") gemarkeerd zijn, worden deze vergeleken 
 * (op basis van titel) met de nieuw-binnengehaalde data, zodat prestaties in `data.json` niet verdwijnen na een fetch.
 * 
 * Verwijdert ook oude flaggers zoals de '_legacyStatus'.
 * 
 * @async
 * @function fetchSeasonData
 * @param {Object} item - Referentie naar het anime "tv" item dat geüpdated en gevuld moet worden met seizoendata.
 * @returns {Promise<void>} Na afloop triggert the applicatie normaal gezien `render()`.
 */
async function fetchSeasonData(item) {
    const info = await fetchTmdbId(item);
    if (!info || info.type === 'movie') return;

    // Bewaar bestaande seizoen-/afleveringsstatussen
    const existingSeasons = new Map();
    if (item.seasons) {
        item.seasons.forEach(s => {
            const epMap = new Map();
            s.episodes.forEach(ep => epMap.set(ep.number, ep.status));
            existingSeasons.set(s.number, epMap);
        });
    }

    // Geavanceerde statusbeheer: Maak een map van alle huidige afleveringen (op titel)
    const statusByTitle = new Map();
    if (item.seasons) {
        item.seasons.forEach(s => {
            s.episodes.forEach(ep => {
                const cleanTitle = ep.name.toLowerCase().trim();
                statusByTitle.set(cleanTitle, ep.status);
            });
        });
    }

    try {
        const showRes = await fetch(`https://api.themoviedb.org/3/tv/${info.id}?api_key=${TMDB_API_KEY}&language=en-US`);
        const showData = await showRes.json();
        
        item.seasons = [];
        item.release_date = showData.first_air_date;

        for (const s of showData.seasons) {
            const seasonRes = await fetch(`https://api.themoviedb.org/3/tv/${info.id}/season/${s.season_number}?api_key=${TMDB_API_KEY}&language=en-US`);
            const seasonData = await seasonRes.json();

            const episodes = (seasonData.episodes || []).map(ep => {
                const cleanTitle = (ep.name || "").toLowerCase().trim();
                const matchedStatus = statusByTitle.get(cleanTitle);
                
                return {
                    number: ep.episode_number,
                    name: ep.name || `Episode ${ep.episode_number}`,
                    air_date: ep.air_date,
                    status: matchedStatus !== undefined ? matchedStatus : -1
                };
            });

            item.seasons.push({
                number: s.season_number,
                name: s.name || `Season ${s.season_number}`,
                episodes: episodes
            });
        }
        delete item._legacyStatus;
        save();
    } catch (e) {
        console.error('Season fetch error:', e);
    }
}

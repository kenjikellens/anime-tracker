// domein/EmbedSources.js

/**
 * Map dictionary van goedgekeurde embed-speler services voor videostreaming.
 * Elke service bevat formatteur-functies voor zowel de 'movie' als de episodische ('tv') syntax.
 * @constant
 * @type {Object.<string, {label: string, movie: function(number|string): string, tv: function(number|string, number, number): string}>}
 */
const EMBED_SOURCES = {
    vsembed: {
        label: 'VSEmbed',
        movie: (id) => `https://vsembed.ru/embed/tmdb/movie?id=${id}`,
        tv:    (id, s, e) => `https://vsembed.ru/embed/tmdb/tv?id=${id}&s=${s}&e=${e}`
    },
    embedsu: {
        label: 'Embed.su',
        movie: (id) => `https://embed.su/embed/movie/${id}`,
        tv:    (id, s, e) => `https://embed.su/embed/tv/${id}/${s}/${e}`
    },
    autoembed: {
        label: 'AutoEmbed',
        movie: (id) => `https://autoembed.co/movie/tmdb-${id}`,
        tv:    (id, s, e) => `https://autoembed.co/tv/tmdb-${id}-${s}-${e}`
    }
};

/**
 * Construeert en geeft de embed-URL terug voor the momenteel geselecteerde videobron.
 * Gebruikt de globale `currentSource` instelling. Valt terug op de "vsembed" indien onbekend.
 * 
 * @function getVidsrcUrl
 * @param {Object} item - Het anime-datastructuur object (bevat minimaal `tmdb_id` en `type`).
 * @param {number} [seasonNum=1] - Het seizoennummer indien van toepassing (alleen voor type 'tv').
 * @param {number} [episodeNum=1] - Het afleveringsnummer indien van toepassing (alleen voor type 'tv').
 * @returns {string|null} De opgemaakte resulterende HTTP URL string, of null als er geen theMovieDb ID aanwezig is.
 */
function getVidsrcUrl(item, seasonNum, episodeNum) {
    if (!item.tmdb_id) return null;
    const src = EMBED_SOURCES[currentSource] || EMBED_SOURCES.vsembed;
    if (item.type === 'movie') {
        return src.movie(item.tmdb_id);
    }
    return src.tv(item.tmdb_id, seasonNum || 1, episodeNum || 1);
}

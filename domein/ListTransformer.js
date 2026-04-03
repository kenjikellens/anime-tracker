// domein/ListTransformer.js

/**
 * Normaliseert tekst voor robuust zoeken op titel.
 *
 * @param {string} value
 * @returns {string}
 */
function normalizeSearchValue(value) {
    return String(value || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}

/**
 * Zet de ruwe lijst om naar renderbare franchise-groepen.
 *
 * @returns {Array<Object>}
 */
function getFilteredSorted() {
    const franchises = new Map();

    state.animeList.forEach((item) => {
        if (!item || typeof item.title !== 'string' || item.title.trim() === '') {
            return;
        }

        const franchiseName = item.franchise || item.title;
        if (!franchises.has(franchiseName)) {
            franchises.set(franchiseName, {
                title: franchiseName,
                items: [],
                _computedStatus: -1,
                rating: -1,
                poster_path: null,
                tmdb_id: null,
                _isGroup: true
            });
        }

        franchises.get(franchiseName).items.push(item);
    });

    let list = Array.from(franchises.values()).map((group) => {
        const itemWithPoster = group.items.find((item) => item.poster_path) || group.items[0];
        const statuses = group.items.map((item) => window.StatusCalculator.getAnimeStatus(item));
        const ratings = group.items
            .map((item) => Number(item.rating))
            .filter((rating) => Number.isFinite(rating));

        group.poster_path = itemWithPoster?.poster_path || null;
        group.tmdb_id = itemWithPoster?.tmdb_id || null;
        group._computedStatus = statuses.includes(0)
            ? 0
            : statuses.includes(-1)
                ? -1
                : 1;
        group.rating = ratings.length > 0 ? Math.max(...ratings) : -1;
        return group;
    });

    list = list.filter((group) => activeFilters.has(group._computedStatus));

    if (currentSearch) {
        const query = normalizeSearchValue(currentSearch);
        list = list.filter((group) => normalizeSearchValue(group.title).includes(query));
    }

    switch (currentSort) {
        case 'title-asc':
            list.sort((a, b) => a.title.localeCompare(b.title));
            break;
        case 'title-desc':
            list.sort((a, b) => b.title.localeCompare(a.title));
            break;
        case 'rating-desc':
            list.sort((a, b) => (b.rating > -1 ? b.rating : -2) - (a.rating > -1 ? a.rating : -2));
            break;
        case 'rating-asc':
            list.sort((a, b) => (a.rating > -1 ? a.rating : -2) - (b.rating > -1 ? b.rating : -2));
            break;
        case 'status':
            list.sort((a, b) => a._computedStatus - b._computedStatus);
            break;
        default:
            break;
    }

    return list;
}

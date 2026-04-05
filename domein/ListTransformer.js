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
 * Bouwt franchise-groepen op basis van AniList relaties.
 * Gebruikt een Union-Find algoritme: items verbonden via geaccepteerde
 * relatie-types (SEQUEL, PREQUEL, SIDE_STORY, SPIN_OFF, ALTERNATIVE, PARENT)
 * worden samengevoegd in dezelfde franchise.
 *
 * @param {Array<Object>} items - Alle items in state.animeList
 * @returns {Map<string, Array<Object>>} Map van franchiseKey → items
 */
function buildFranchiseGroups(items) {
    const idToItem = new Map();
    const parent = new Map();

    items.forEach((item) => {
        if (item.anilist_id) {
            idToItem.set(item.anilist_id, item);
            parent.set(item.anilist_id, item.anilist_id);
        }
    });

    // Union-Find: find root
    function find(id) {
        while (parent.get(id) !== id) {
            parent.set(id, parent.get(parent.get(id))); // path compression
            id = parent.get(id);
        }
        return id;
    }

    // Union-Find: merge two sets
    function union(a, b) {
        const rootA = find(a);
        const rootB = find(b);
        if (rootA !== rootB) {
            parent.set(rootB, rootA);
        }
    }

    const accepted = AnilistApi.getAcceptedRelationTypes();

    // Bouw de graph: verbind items via hun relaties
    items.forEach((item) => {
        if (!item._relations || !item.anilist_id) return;

        item._relations.forEach((rel) => {
            if (accepted.has(rel.type) && idToItem.has(rel.targetId)) {
                union(item.anilist_id, rel.targetId);
            }
        });
    });

    // Groepeer items per franchise-root
    const clusters = new Map();
    items.forEach((item) => {
        if (!item.anilist_id) return;
        const root = find(item.anilist_id);
        if (!clusters.has(root)) {
            clusters.set(root, []);
        }
        clusters.get(root).push(item);
    });

    return clusters;
}

/**
 * Kiest de beste franchise-naam uit een cluster van items.
 * Strategie: kortste titel (inclusief Engelse titel als beschikbaar).
 *
 * @param {Array<Object>} clusterItems
 * @returns {string}
 */
function pickFranchiseName(clusterItems) {
    if (clusterItems.length === 0) return 'Onbekend';
    // Sorteer op title length, pak de kortste
    const sorted = [...clusterItems].sort((a, b) => a.title.length - b.title.length);
    return sorted[0].title;
}

/**
 * Zet de ruwe lijst om naar renderbare franchise-groepen.
 * In het nieuwe model worden items gegroepeerd via AniList relaties
 * in plaats van een handmatig `franchise` veld.
 *
 * @returns {Array<Object>}
 */
function getFilteredSorted() {
    const clusters = buildFranchiseGroups(state.animeList);
    const franchises = [];

    clusters.forEach((clusterItems) => {
        if (clusterItems.length === 0) return;

        // Sorteer items op release_date binnen de franchise
        clusterItems.sort((a, b) => {
            const da = a.release_date || '0000-00-00';
            const db = b.release_date || '0000-00-00';
            return da.localeCompare(db);
        });

        const franchiseName = pickFranchiseName(clusterItems);
        const itemWithPoster = clusterItems.find((item) => item.poster_path) || clusterItems[0];

        // Bereken groepsstatus: als alles completed → 1, als minstens 1 current → 0, anders -1
        const statuses = clusterItems.map((item) => window.StatusCalculator.getAnimeStatus(item));
        let computedStatus;
        if (statuses.every((s) => s === 1)) {
            computedStatus = 1;
        } else if (statuses.some((s) => s === 0 || s === 1)) {
            computedStatus = 0;
        } else {
            computedStatus = -1;
        }

        // Bereken groepsrating: hoogste rating in de franchise
        const ratings = clusterItems
            .map((item) => Number(item.rating))
            .filter((r) => Number.isFinite(r) && r >= 0);
        const groupRating = ratings.length > 0 ? Math.max(...ratings) : -1;

        franchises.push({
            title: franchiseName,
            items: clusterItems,
            _computedStatus: computedStatus,
            rating: groupRating,
            poster_path: itemWithPoster?.poster_path || null,
            tmdb_id: itemWithPoster?.tmdb_id || null,
            _isGroup: true
        });
    });

    // Filter op actieve filters
    let list = franchises.filter((group) => activeFilters.has(group._computedStatus));

    // Zoekfilter
    if (currentSearch) {
        const query = normalizeSearchValue(currentSearch);
        list = list.filter((group) => {
            // Zoek in franchise-naam EN in individuele item-titels
            if (normalizeSearchValue(group.title).includes(query)) return true;
            return group.items.some((item) => normalizeSearchValue(item.title).includes(query));
        });
    }

    // Sorteren
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

const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '../data/data.json');

/**
 * Checks whether an anime franchise is fully watched and therefore immutable.
 * Evaluates both the parent watch status and all child item statuses.
 * @param {Object} anime - Anime franchise entry from data.json.
 * @returns {boolean} True if parent status is 1 or all items have status 1.
 */
function isFullyWatched(anime) {
    if (anime.status === 1) return true;
    return Array.isArray(anime.items) && anime.items.length > 0 && anime.items.every(item => item.status === 1);
}

/**
 * Atomically writes the anime dataset to data/data.json via a temporary file.
 * Prevents partial JSON corruption if the process is interrupted mid-write.
 * @param {Array<Object>} data - Full anime dataset array.
 */
function writeDataAtomic(data) {
    const tmpPath = `${DATA_PATH}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 4), 'utf-8');
    fs.renameSync(tmpPath, DATA_PATH);
}

/**
 * Executes an AniList GraphQL request with timeout and rate-limit handling.
 * Depends on the external AniList GraphQL endpoint.
 * @param {string} query - GraphQL query string.
 * @param {Object} variables - GraphQL query variables.
 * @returns {Promise<Object|null>} Parsed JSON payload or null on non-OK HTTP status.
 */
async function fetchAniList(query, variables = {}) {
    const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) {
        console.warn(`  AniList HTTP ${response.status}`);
        return null;
    }
    return response.json();
}

const SEARCH_QUERY = `
query ($search: String) {
    Media(search: $search, type: ANIME) {
        id
        title {
            english
            romaji
        }
        relations {
            edges {
                relationType
                node {
                    id
                    title {
                        english
                        romaji
                    }
                    format
                    status
                    episodes
                }
            }
        }
    }
}
`;

/**
 * Scans non-watched anime entries in data.json for new sequels or airing status transitions.
 * Mutates data.json on disk only for non-immutable entries when changes are detected.
 */
async function main() {
    console.log('Loading data.json...');
    const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
    let changesMade = false;

    console.log(`Total parent entries: ${data.length}`);

    for (let i = 0; i < data.length; i++) {
        const anime = data[i];
        if (isFullyWatched(anime)) {
            console.log(`[${i + 1}/${data.length}] Skipping immutable watched entry: ${anime.title}`);
            continue;
        }
        console.log(`[${i + 1}/${data.length}] Checking: ${anime.title}...`);

        try {
            const res = await fetchAniList(SEARCH_QUERY, { search: anime.title });
            if (!res || !res.data || !res.data.Media) {
                console.log(`  No AniList data found for ${anime.title}`);
                continue;
            }

            if (!Array.isArray(anime.items)) {
                anime.items = [];
            }

            const media = res.data.Media;
            if (!anime.anilistId) {
                anime.anilistId = media.id;
                changesMade = true;
            }

            const existingIds = new Set(anime.items.map(item => item.id).filter(Boolean));

            // Check relations for sequels/spinoffs
            const relations = media.relations?.edges || [];
            for (const rel of relations) {
                const node = rel.node;
                // Filter relevant relations (TV, MOVIE, OVA, SPECIAL)
                if (!['TV', 'MOVIE', 'OVA', 'SPECIAL'].includes(node.format)) continue;
                if (['PREQUEL', 'PARENT', 'CHARACTER'].includes(rel.relationType)) continue;

                const englishTitle = node.title.english || node.title.romaji;
                if (!englishTitle) continue;
                
                // Check if already in items
                const existing = anime.items.find(item => 
                    item.title.toLowerCase() === englishTitle.toLowerCase() ||
                    (item.anilistId && item.anilistId === node.id)
                );

                let status = -1;
                if (node.status === 'RELEASING') status = 3;
                else if (node.status === 'NOT_YET_RELEASED') status = 2;
                else if (node.status === 'FINISHED') status = -1;

                if (!existing) {
                    const baseSlug = englishTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'untitled';
                    let slug = baseSlug;
                    let suffix = 2;
                    while (existingIds.has(slug)) {
                        slug = `${baseSlug}-${suffix++}`;
                    }
                    existingIds.add(slug);

                    let type = 'SERIE';
                    if (node.format === 'MOVIE') type = 'MOVIE';
                    else if (node.format === 'OVA') type = 'OVA';
                    else if (node.format === 'SPECIAL') type = 'SPECIAL';

                    const newItem = {
                        id: slug,
                        title: englishTitle,
                        status: status,
                        type: type,
                        rating: 0,
                        watchedEpisodes: [],
                        episodesCount: node.episodes || (type === 'MOVIE' ? 1 : 0),
                        anilistId: node.id
                    };

                    anime.items.push(newItem);
                    console.log(`  + ADDED NEW ITEM: ${englishTitle} (Type: ${type}, Status: ${status})`);
                    changesMade = true;
                } else {
                    // Update status if transitioned (e.g., 2 -> 3 or 3 -> -1)
                    if (existing.status === 2 && status === 3) {
                        existing.status = 3;
                        if (node.episodes) existing.episodesCount = node.episodes;
                        console.log(`  * STATUS CHANGE (Upcoming -> Airing): ${existing.title}`);
                        changesMade = true;
                    } else if (existing.status === 3 && status === -1) {
                        existing.status = -1;
                        if (node.episodes) existing.episodesCount = node.episodes;
                        console.log(`  * STATUS CHANGE (Airing -> Finished): ${existing.title}`);
                        changesMade = true;
                    }
                    if (!existing.episodesCount && node.episodes) {
                        existing.episodesCount = node.episodes;
                        changesMade = true;
                    }
                }
            }

            // Small delay to respect rate limits
            await new Promise(r => setTimeout(r, 400));
        } catch (err) {
            console.error(`  Error processing ${anime.title}:`, err.message);
        }
    }

    if (changesMade) {
        console.log('Saving updated data.json...');
        writeDataAtomic(data);
        console.log('Successfully updated data.json!');
    } else {
        console.log('No new items or status changes needed.');
    }
}

main().catch(err => {
    console.error('Fatal error in anime_checker_auto:', err);
    process.exit(1);
});

const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '../data/data.json');

const QUERY_BY_ID = `
query ($id: Int) {
  Media (id: $id, type: ANIME) {
    id
    seasonYear
    startDate { year }
    genres
    studios {
      nodes {
        name
        isAnimationStudio
      }
    }
  }
}`;

const QUERY_BY_SEARCH = `
query ($search: String) {
  Media (search: $search, type: ANIME, sort: SEARCH_MATCH) {
    id
    seasonYear
    startDate { year }
    genres
    studios {
      nodes {
        name
        isAnimationStudio
      }
    }
  }
}`;

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
 * Fetches studio, release year, and genre metadata from AniList with retry and timeout.
 * Depends on the external AniList GraphQL endpoint.
 * @param {string} title - Anime title fallback for search queries.
 * @param {number|string|null} anilistId - Optional AniList media ID for direct lookup.
 * @returns {Promise<Object|null>} Metadata object or null on failure.
 */
async function fetchAniListMetadata(title, anilistId) {
    const parsedId = anilistId ? parseInt(anilistId, 10) : NaN;
    const useId = !Number.isNaN(parsedId);
    const query = useId ? QUERY_BY_ID : QUERY_BY_SEARCH;
    const variables = useId ? { id: parsedId } : { search: title };

    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const response = await fetch('https://graphql.anilist.co', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({ query, variables }),
                signal: AbortSignal.timeout(15000)
            });

            if (response.status === 429) {
                console.warn(`Rate limited (429) for "${title}". Retrying in 3s (Attempt ${attempt}/3)...`);
                await new Promise(r => setTimeout(r, 3000));
                continue;
            }

            if (!response.ok) {
                console.warn(`Failed response for "${title}": ${response.status}`);
                return null;
            }

            const data = await response.json();
            const media = data.data?.Media;
            if (!media) return null;

            const year = media.seasonYear || media.startDate?.year || null;
            const genres = media.genres || [];
            
            let studio = '';
            if (media.studios && media.studios.nodes && media.studios.nodes.length > 0) {
                const mainStudio = media.studios.nodes.find(s => s.isAnimationStudio) || media.studios.nodes[0];
                studio = mainStudio ? mainStudio.name : '';
            }

            return { year, genres, studio, anilistId: media.id };
        } catch (err) {
            console.error(`Error fetching for "${title}":`, err.message);
            await new Promise(r => setTimeout(r, 1000));
        }
    }
    return null;
}

/**
 * Enriches non-watched anime entries in data.json with missing studio, year, and genre metadata.
 * Mutates data.json on disk using atomic writes while preserving immutable watched entries.
 */
async function main() {
    console.log('Reading data.json...');
    const rawData = fs.readFileSync(DATA_PATH, 'utf-8');
    const animes = JSON.parse(rawData);

    let updatedCount = 0;
    console.log(`Found ${animes.length} anime entries. Starting metadata enrichment...`);

    for (let i = 0; i < animes.length; i++) {
        const anime = animes[i];
        if (isFullyWatched(anime)) {
            continue;
        }
        
        // Skip if already enriched with studio, year, and genres
        if (anime.studio && anime.year && Array.isArray(anime.genres) && anime.genres.length > 0) {
            continue;
        }

        console.log(`[${i + 1}/${animes.length}] Enriching "${anime.title}"...`);
        const meta = await fetchAniListMetadata(anime.title, anime.anilistId);

        if (meta) {
            if (!anime.anilistId) anime.anilistId = meta.anilistId;
            anime.studio = meta.studio || anime.studio || '';
            anime.year = meta.year || anime.year || null;
            anime.genres = meta.genres && meta.genres.length > 0 ? meta.genres : (anime.genres || []);
            updatedCount++;
            console.log(`  -> Studio: ${anime.studio} | Year: ${anime.year} | Genres: ${anime.genres.join(', ')}`);
        } else {
            anime.studio = anime.studio || '';
            anime.year = anime.year || null;
            anime.genres = anime.genres || [];
        }

        // Save progress to data.json periodically every 5 items
        if ((i + 1) % 5 === 0) {
            writeDataAtomic(animes);
        }

        // Delay 1000ms to strictly observe AniList rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`Enrichment finished. Updated ${updatedCount} entries.`);
    writeDataAtomic(animes);
    console.log('Saved data.json successfully!');
}

main().catch(err => {
    console.error('Fatal error in script:', err);
    process.exit(1);
});

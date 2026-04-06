export class AnilistApi {
    static async fetchMediaByTitle(title) {
        const query = `
        query ($search: String) {
          Media (search: $search, type: ANIME, sort: SEARCH_MATCH) {
            id
            title { romaji english }
            coverImage { large color }
            format
            episodes
          }
        }`;

        const variables = { search: title };

        try {
            const res = await fetch('https://graphql.anilist.co', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({ query, variables })
            });

            const data = await res.json();
            if (data.data && data.data.Media) {
                return data.data.Media;
            }
            return null;
        } catch (err) {
            console.error("Anilist API fetch failed for", title, err);
            return null;
        }
    }
}

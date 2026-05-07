---
description: Guidelines for managing anime data and documentation
---

# Anime Data Management

> [!IMPORTANT]
> **Thorough Research Required**: Always verify the complete franchise details (Seasons, OVAs, Specials, Movies, ONAs) on AniList or similar databases before adding. Do not rely on memory; ensure every item in the series is accounted for.

To maintain database integrity and ensure seamless UI rendering, follow these standards when adding, updating, or migrating anime entries.

## 1. Database: `data/data.json`

### Parent Object
*   **ID**: Lowercase-slug format (e.g., `"horimiya"` or `"rascal-does-not-dream"`).
*   **Title**: The official global title of the franchise (English version).
*   **Status**: Reflects the overall progress of the franchise (see [Status Codes](#status-codes)).
*   **Rating**: Initialize with a default value of `0.0`.
*   **Images**: Use AniList CDN links for `coverImage`.

### Items Array
Each entry (Season, Movie, OVA, etc.) must be an object in the `items` array:
*   **Item ID**: Lowercase-slug format of the item's title.
    *   *Example*: For `"Horimiya: The Missing Pieces"`, the ID is `"horimiya-the-missing-pieces"`.
    *   *Rule*: Remove special characters and replace spaces with dashes.
*   **Title**: The official English title of this specific item.
*   **Type**: Must be one of: `SERIE`, `MOVIE`, `OVA`, `SPECIAL`, `ONA`, `SPIN-OFF`.
*   **Episodes**: 
    *   `episodesCount`: Total number of episodes.
    *   `watchedEpisodes`: An array of numbers tracking progress (e.g., `[1, 2, 3]`). Initialize as `[]`.
*   **Item Rating**: Individual score for this specific item.

### Status Codes
These codes are mandatory for both franchise (parent) and item levels:

| Code | Label | Logic |
| :--- | :--- | :--- |
| **`1`** | **Watched** | Fully completed. |
| **`0`** | **Watching** | Active progress in `watchedEpisodes`. |
| **`-1`** | **To Watch** | Planned for the future. |
| **`2`** | **New** | Recently added or upcoming seasons. |

---

## 2. Documentation: `docs/`

### `docs/te_bekijken.md` (To Watch)
For any anime with a status of `-1` or `2`:
*   Use a `## [Anime Title]` header.
*   List items using checkboxes: `- [ ] Item Name (Type - X eps)`.

### `docs/al_bekeken.md` (Already Watched)
For any items with a status of `1`:
*   Maintain the same header and list structure.
*   Used for historical tracking and review overview.

### `docs/shortlist.md`
This file contains a simple list of franchise titles for quick reference.
*   **Maintenance**: Add the franchise title to this list when a new parent object is created.
*   **Sorting**: Ensure the list remains in **alphabetical order**.

### `docs/suggesties.md`
Used for brainstorming features and tracking anime that are not yet in the main database.
*   Update this when moving an entry from "Suggestions" to `data.json`.
*   Add new feature requests or UI improvements here.

---

## 3. Core Constraints & Best Practices

1.  **Title Alignment**: The `title` in `data.json` must be **identical** to the `## Header` used in the Markdown files.
2.  **Duplicate Prevention**: Always search `data.json` for existing slugs before creating a new entry.
3.  **Slug Persistence**: Never change an `id` once created. It serves as the unique key for local storage, history, and internal linking.
4.  **Automatic Hydration**: Favor adding an `anilistId` if available; the application logic in `App.js` will attempt to fetch missing metadata (images, episode counts) automatically.
5.  **Sequential Integrity**: When adding a franchise, ensure items are listed in their chronological or intended watch order within the `items` array.
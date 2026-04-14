---
description: # Anime Data Beheer
---

# Anime Data Management

To maintain database integrity and ensure seamless UI rendering, follow these standards when adding, updating, or migrating anime entries.

## 1. Database: `data/data.json`

### Parent Object
*   **ID**: Lowercase-slug format (e.g., `"horimiya"` or `"rascal-does-not-dream"`).
*   **Title**: The official global title of the franchise.
*   **Status**: Reflects the overall progress of the franchise (see [Status Codes](#status-codes)).
*   **Rating**: Global rating (0.0 to 10.0). Usually 0 if no items are watched.
*   **AniList ID**: (`anilistId`) The numeric ID from AniList to enable automated metadata hydration (covers, banners, and episode counts).
*   **Images**: Use AniList CDN links for `coverImage` and `bannerImage`.

### Items Array
Each entry (Season, Movie, OVA) must be an object in the `items` array:
*   **Item ID**: Format: `{parent-id}-ep-{index}` (e.g., `"horimiya-ep-0"`).
*   **Type**: Must be one of: `SERIE`, `MOVIE`, `OVA`, `SPECIAL`, `ONA`, `SPIN-OFF`.
*   **Episodes**: 
    *   `episodesCount`: Total number of episodes.
    *   `watchedEpisodes`: An array of numbers tracking progress (e.g., `[1, 2, 3]`). Initial value is `[]`.
*   **Item Rating**: Individual score for that specifically.

### Status Codes
These codes are mandatory for both parent and item levels:
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
*   List items using checkboxes: `- [ ] Season Name (Type - X eps)`.

### `docs/al_bekeken.md` (Already Watched)
For any items with a status of `1`:
*   Maintain the same header and list structure.
*   Used for historical tracking and review overview.

---

## 3. Core Constraints & Best Practices
1.  **Title Alignment**: The `title` in `data.json` must be **identical** to the `## Header` used in the Markdown files.
2.  **Duplicate Prevention**: Always search `data.json` for existing slugs before creating a new entry.
3.  **Slug Persistence**: Never change an `id` once it has been created, as it is used for local storage keys and history.
4.  **Automatic Hydration**: Favor adding an `anilistId` over manual data entry; the system's `App.js` will attempt to fetch missing images and counts automatically.

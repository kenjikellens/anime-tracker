---
description: Anime release checker — verifies all tracked anime for new releases, status changes, and upcoming content per anime via web search (primary). AniList API is reserved ONLY for fetching metadata when adding a specific new item.
---

# Anime Release Checker Workflow

This workflow checks all tracked anime franchises for new releases (seasons, movies, OVAs, ONAs, specials) and status updates.

---

## 1. Core Principles & Status Rules

### Status Codes
* **Parent Anime Objects** (`data/data.json`): May only use watch-progress status codes:
  * `-1` = **To Watch**
  * `0` = **Watching**
  * `1` = **Watched**
* **Item Objects** (`data/data.json`): May use watch-progress codes (`-1`, `0`, `1`) and release-state codes:
  * `2` = **Upcoming** (announced but not yet released)
  * `3` = **Airing** (currently releasing episodes)

> [!CRITICAL]
> 1. Never assign status `2` or `3` to a parent anime object.
> 2. Never use `"New"` as a data status string.
> 3. Do NOT use web browser / DOM to verify changes; ask the user to verify instead.
> 4. Always use **English titles** for anime and item names in `data/data.json`.
> 5. **NEVER USE ANILIST API TO AUTO-UPDATE EXISTING ENTRIES OR USER WATCH PROGRESS IN `data.json`**: AniList API is strictly reserved ONLY for fetching metadata when adding a specific new item.
> 6. **CHECK EXISTING DATA FIRST**: Always inspect `data/data.json` for the current anime entry to know its exact existing items, episode counts, and statuses BEFORE performing web search lookups.
> 7. **NON-STOP STRICT SEQUENTIAL EXECUTION**:
>    - Execute EXACTLY ONE search call for ONE anime at a time.
>    - Immediately update `data/data.json`, `DOCS/data/`, and `task.md` for THAT anime if needed.
>    - IMMEDIATELY move to the next anime without calling multiple searches in parallel and without stopping until ALL anime in `task.md` are completed `[x]`.
> 8. **SKIP FULLY WATCHED ANIME**: NEVER automatically modify, update, or add items to an anime where the parent status is `1` (Watched) or where all items are fully watched. Fully watched anime must be completely skipped by automatic updates.

### Item Rules for Airing & Upcoming
* **Do Not Touch Completed Anime**: If an anime has status `1` (Watched) or all its items are marked watched, DO NOT check for new items or update it automatically.
* **Airing (status `3`)**: The item MUST already include `episodesCount` with the total announced episode count (even if not all episodes have aired yet).
* **Upcoming (status `2`)**: The item MUST be created with `episodesCount` set to the announced count (or `1` for movies). If unknown, set `episodesCount` to `0`.

---

## 2. Step 1: Create Task List (MANDATORY UI ARTIFACT)

Before doing any lookups, create a `task.md` artifact (using `write_to_file` with `ArtifactMetadata` where `UserFacing: true`) listing **every anime** from `data/data.json`. Each entry starts as `[ ]` (unchecked) and gets marked `[x]` after it has been searched and processed.

---

## 3. Step 2: Non-Stop Sequential Loop

For each remaining unchecked anime in `task.md`:
1. Read the anime's entry in `data/data.json` to inspect existing items and statuses.
2. Execute ONE search (`search_web`) for THAT single anime.
3. Update `data/data.json` if new sezoenen/OVAs/movies or status changes are found.
4. Update `DOCS/data/` files if needed.
5. Mark `[x]` in `task.md`.
6. Repeat for the next anime immediately without searching multiple anime at once.

---

## 4. Step 3: Final Summary Report

Once all entries in `task.md` are checked `[x]`, output the full summary report of all added items and status updates to the user.

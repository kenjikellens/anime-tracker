---
description: Token-efficient anime release checker — verifies all tracked anime for new releases, status changes, and upcoming content using automated scripts.
---

# Token-Efficient Anime Release Checker Workflow

This workflow provides a step-by-step procedure for AI assistants to efficiently check all tracked anime franchises for new releases (seasons, movies, OVAs, ONAs, specials) and status updates with minimal token consumption.

---

## 1. Core Principles & Status Rules

### Status Codes
* **Parent Anime Objects**: May only use watch-progress status codes:
  * `-1` = **To Watch**
  * `0` = **Watching**
  * `1` = **Watched**
* **Item Objects**: May use watch-progress codes (`-1`, `0`, `1`) and release-state codes:
  * `2` = **Upcoming** (announced but not yet released)
  * `3` = **Airing** (currently releasing episodes)

> [!CRITICAL]
> 1. Never assign status `2` or `3` to a parent anime object.
> 2. Never use `"New"` as a data status string.
> 3. Do NOT use web browser / DOM to verify changes; ask the user to verify instead.
> 4. Use AniList GraphQL API for queries — never use web browser scrapers.

---

## 2. Step 1: Run Automated Release Checker Script

Do **NOT** read `data/data.json` into prompt context to manually search each anime. Execute the Python release check script directly:

```powershell
py scripts/check_anime_releases.py --write
```

> [!NOTE]
> The script queries the AniList GraphQL API for all 127+ anime entries. Expect execution to take **3 to 5 minutes** (due to rate limit throttling). Do not interrupt or timeout early.

---

## 3. Step 2: Parse Delta Output (Token Minimization)

To prevent cluttering context with hundreds of `skipped` entries, filter the JSON report output to extract only actionable changes:

```powershell
py -c "import subprocess, json; res = subprocess.run(['py', 'scripts/check_anime_releases.py', '--write'], capture_output=True, text=True); data = json.loads(res.stdout); print(json.dumps({'added': data.get('added', []), 'updated': data.get('updated', []), 'errors': data.get('errors', [])}, indent=2, ensure_ascii=False))"
```

Only read the resulting filtered summary JSON into context:
- `added`: Newly discovered seasons, movies, OVAs, or specials (status `2` or `3`).
- `updated`: Existing items that transitioned status (e.g., status `2` -> `3`).
- `errors`: Anime titles that encountered API lookup issues.

---

## 4. Step 3: Backfill `anilistId` (Performance Optimization)

If any entries in `added` or `updated` were matched via title search, check if they have an `anilistId` on the parent object in `data/data.json`.

If `anilistId` is missing:
1. Fetch the main franchise AniList ID from the candidate result.
2. Add `"anilistId": <int_id>` to the parent anime object in `data/data.json`.
3. This turns future checks for this franchise into fast single-query ID lookups.

---

## 5. Step 4: Verify Airing Items (Status `3` -> Finished Transition)

AniList items currently marked as status `3` (Airing) do not automatically revert to `-1` (To Watch) when they finish airing via the script alone.

1. Find all items in `data/data.json` with `"status": 3`.
2. For each airing item, perform a single AniList GraphQL query:
```graphql
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    id
    status
    episodes
  }
}
```
3. If AniList reports status `FINISHED`:
   - Update item `"status"` from `3` to `-1` (To Watch).
   - Update item `"episodesCount"` to the final episode count.

---

## 6. Step 5: Sync Markdown Documentation (`DOCS/`)

Only update the Markdown documentation for items present in `added` or `updated`:

### `DOCS/te_bekijken.md`
For any new items added with status `2` (Upcoming) or status `3` (Airing):
1. Locate the header `## [Anime Title]` in `DOCS/te_bekijken.md`.
2. Append the checkbox entry using standard format:
   - For Upcoming (`2`): `- [ ] Item Title (Type - Announced)` or `- [ ] Item Title (Type - Announced 2026)`
   - For Airing (`3`): `- [ ] Item Title (Type - Airing - Started Month Day, Year)`
3. If the header `## [Anime Title]` does not exist in `te_bekijken.md` and the franchise is not yet completed:
   - Create the header `## [Anime Title]` in alphabetical order.
   - List the item under the header.

### `DOCS/shortlist.md`
If a completely new franchise was added to `data/data.json`, add the franchise title to `DOCS/shortlist.md` in alphabetical order.

---

## 7. Step 6: User Verification & Report

Summarize the execution results to the user:
- Total new items added (with types and statuses).
- Status updates applied (e.g. Upcoming -> Airing).
- Any API errors or ambiguous matches needing user input.
- Ask the user to verify the changes (do NOT use browser subagents or browser DOM tools).

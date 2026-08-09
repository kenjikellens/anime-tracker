---
trigger: always_on
---

do not use web browser (DOM) to verify changes, ask the user to verify instead!

Never use AniList API to automatically or directly update existing entries or user watch progress in data.json! AniList API is strictly reserved ONLY for fetching metadata when adding a specific new item.

status `2` means item-only Upcoming and status `3` means item-only Airing. Never use "New" as a data status, and never assign `2` or `3` to a parent anime object.

Never duplicate or copy-paste CSS rules across specific selectors to copy a style. Always reuse existing CSS classes directly in HTML/JS elements to apply styles, and delete unused CSS rules afterwards.


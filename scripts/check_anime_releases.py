#!/usr/bin/env python3
"""Check AniList for upcoming/airing releases for every anime group."""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.request
from urllib.error import HTTPError, URLError
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = PROJECT_ROOT / "data" / "data.json"
STATUS_UPCOMING = 2
STATUS_AIRING = 3
RELEASE_STATUSES = {STATUS_UPCOMING, STATUS_AIRING}
WATCH_STATUSES = {-1, 0, 1}
STOPWORDS = {
    "a",
    "an",
    "and",
    "arc",
    "cour",
    "de",
    "final",
    "movie",
    "no",
    "of",
    "ova",
    "part",
    "season",
    "special",
    "the",
    "to",
}


SEARCH_QUERY = """
query ($search: String) {
  Media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
    id
    title {
      romaji
      english
      native
    }
    synonyms
    format
    status
    episodes
    relations {
      nodes {
        id
        type
        title {
          romaji
          english
          native
        }
        synonyms
        format
        status
        episodes
      }
    }
  }
}
"""


ID_QUERY = """
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    id
    title {
      romaji
      english
      native
    }
    synonyms
    format
    status
    episodes
    relations {
      nodes {
        id
        type
        title {
          romaji
          english
          native
        }
        synonyms
        format
        status
        episodes
      }
    }
  }
}
"""


def normalize(text: str | None) -> str:
    text = (text or "").lower().replace("&", " and ")
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def tokens(text: str | None) -> set[str]:
    return {token for token in normalize(text).split() if len(token) > 2 and token not in STOPWORDS}


def slugify(text: str) -> str:
    value = normalize(text).replace(" ", "-")
    return value or "untitled"


def canonical_title(media: dict) -> str:
    title = media.get("title") or {}
    return title.get("english") or title.get("romaji") or title.get("native") or "Untitled anime release"


def title_pool(media: dict) -> list[str]:
    title = media.get("title") or {}
    values = [title.get("english"), title.get("romaji"), title.get("native")]
    values.extend(media.get("synonyms") or [])
    return [value for value in values if value]


def release_status(anilist_status: str | None) -> int | None:
    if anilist_status == "NOT_YET_RELEASED":
        return STATUS_UPCOMING
    if anilist_status == "RELEASING":
        return STATUS_AIRING
    return None


def item_type(format_name: str | None) -> str:
    mapping = {
        "TV": "SERIE",
        "TV_SHORT": "SERIE",
        "MOVIE": "MOVIE",
        "OVA": "OVA",
        "ONA": "ONA",
        "SPECIAL": "SPECIAL",
        "MUSIC": "SPECIAL",
    }
    return mapping.get(format_name or "", "SERIE")


def anilist_request(query: str, variables: dict, retries: int, retry_delay: float) -> dict | None:
    body = json.dumps({"query": query, "variables": variables}).encode("utf-8")
    request = urllib.request.Request(
        "https://graphql.anilist.co",
        data=body,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "RASCAL-release-check/2.0",
        },
        method="POST",
    )
    for attempt in range(retries + 1):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                payload = json.loads(response.read().decode("utf-8"))
            break
        except HTTPError as exc:
            if exc.code != 429 or attempt >= retries:
                raise
            time.sleep(retry_delay * (attempt + 1))
    else:
        return None

    if payload.get("errors"):
        raise RuntimeError(json.dumps(payload["errors"], ensure_ascii=False))
    return (payload.get("data") or {}).get("Media")


def fetch_by_search(search: str, retries: int, retry_delay: float) -> dict | None:
    return anilist_request(SEARCH_QUERY, {"search": search}, retries, retry_delay)


def fetch_by_id(media_id: int, retries: int, retry_delay: float) -> dict | None:
    return anilist_request(ID_QUERY, {"id": media_id}, retries, retry_delay)


def load_data() -> list[dict]:
    with DATA_FILE.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def save_data(data: list[dict]) -> None:
    with DATA_FILE.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=4, ensure_ascii=False)
        handle.write("\n")


def existing_titles(anime: dict) -> set[str]:
    values = {normalize(anime.get("title"))}
    values.update(normalize(item.get("title")) for item in anime.get("items") or [])
    return {value for value in values if value}


def title_sets(anime: dict) -> list[set[str]]:
    values = [anime.get("title")]
    values.extend(item.get("title") for item in anime.get("items") or [])
    return [token_set for token_set in (tokens(value) for value in values) if token_set]


def title_matches_existing(media: dict, existing_normalized: set[str]) -> bool:
    return any(normalize(title) in existing_normalized for title in title_pool(media))


def related_to_anime(media: dict, anime_token_sets: list[set[str]]) -> bool:
    media_tokens = set()
    for title in title_pool(media):
        media_tokens.update(tokens(title))
    if not media_tokens:
        return False

    for known_tokens in anime_token_sets:
        overlap = media_tokens & known_tokens
        if len(overlap) >= 2:
            return True
        if len(known_tokens) == 1 and known_tokens <= media_tokens:
            return True
    return False


def relations(media: dict) -> list[dict]:
    return [
        node
        for node in (((media.get("relations") or {}).get("nodes")) or [])
        if node.get("type") == "ANIME"
    ]


def collect_candidates(anime: dict, delay: float, deep: bool, retries: int, retry_delay: float) -> tuple[list[dict], list[dict]]:
    existing_normalized = existing_titles(anime)
    anime_token_sets = title_sets(anime)
    seeds = []
    if anime.get("anilistId"):
        media = fetch_by_id(int(anime["anilistId"]), retries, retry_delay)
        if media:
            seeds.append(media)
        if delay:
            time.sleep(delay)

    search_terms = [anime.get("title")]
    if deep:
        search_terms.extend(item.get("title") for item in anime.get("items") or [])

    seen_terms = set()
    for term in search_terms:
        term_norm = normalize(term)
        if not term_norm or term_norm in seen_terms:
            continue
        seen_terms.add(term_norm)
        media = fetch_by_search(term, retries, retry_delay)
        if media and (title_matches_existing(media, existing_normalized) or related_to_anime(media, anime_token_sets)):
            seeds.append(media)
        if delay:
            time.sleep(delay)

    candidates_by_id = {}
    rejected = []
    for media in seeds:
        media_id = media.get("id")
        if media_id:
            candidates_by_id[media_id] = media
        for node in relations(media):
            node_id = node.get("id")
            if not node_id:
                continue
            if title_matches_existing(node, existing_normalized) or related_to_anime(node, anime_token_sets):
                candidates_by_id[node_id] = node
            else:
                rejected.append({"title": canonical_title(node), "reason": "relation title did not match this franchise"})

    return sorted(candidates_by_id.values(), key=lambda item: item.get("id") or 0), rejected


def media_to_item(media: dict, existing_ids: set[str]) -> dict:
    title = canonical_title(media)
    item_id = slugify(title)
    if item_id in existing_ids:
        base = item_id
        suffix = 2
        while item_id in existing_ids:
            item_id = f"{base}-{suffix}"
            suffix += 1

    episodes = media.get("episodes")
    if not episodes and media.get("format") == "MOVIE":
        episodes = 1

    return {
        "id": item_id,
        "title": title,
        "status": release_status(media.get("status")),
        "type": item_type(media.get("format")),
        "rating": 0,
        "watchedEpisodes": [],
        "episodesCount": episodes or 0,
    }


def apply_updates(data: list[dict], delay: float, deep: bool, retries: int, retry_delay: float) -> dict:
    report = {"added": [], "updated": [], "skipped": [], "errors": []}

    for anime in data:
        anime_id = anime.get("id")
        if anime.get("status") not in WATCH_STATUSES:
            anime["status"] = -1
            report["updated"].append({"anime": anime_id, "title": anime.get("title"), "field": "status", "to": -1})

        try:
            candidates, rejected = collect_candidates(anime, delay, deep, retries, retry_delay)
        except (OSError, URLError, HTTPError, RuntimeError, ValueError) as exc:
            report["errors"].append({"anime": anime_id, "title": anime.get("title"), "error": str(exc)})
            continue

        items = anime.setdefault("items", [])
        existing_by_title = {normalize(item.get("title")): item for item in items}
        existing_ids = {item.get("id") for item in items if item.get("id")}

        for rejected_item in rejected:
            report["skipped"].append({"anime": anime_id, **rejected_item})

        for media in candidates:
            status = release_status(media.get("status"))
            title = canonical_title(media)
            normalized_title = normalize(title)
            existing = existing_by_title.get(normalized_title)

            if existing:
                current = existing.get("status")
                if current in RELEASE_STATUSES and status in RELEASE_STATUSES and current != status:
                    existing["status"] = status
                    existing["watchedEpisodes"] = []
                    report["updated"].append({"anime": anime_id, "title": existing.get("title"), "from": current, "to": status})
                else:
                    report["skipped"].append({"anime": anime_id, "title": title, "reason": "already tracked"})
                continue

            if status not in RELEASE_STATUSES:
                report["skipped"].append({"anime": anime_id, "title": title, "reason": f"AniList status {media.get('status')} is not upcoming/airing"})
                continue

            item = media_to_item(media, existing_ids)
            existing_ids.add(item["id"])
            existing_by_title[normalized_title] = item
            items.append(item)
            report["added"].append({"anime": anime_id, "title": item["title"], "status": item["status"], "type": item["type"]})

    return report


def main() -> int:
    parser = argparse.ArgumentParser(description="Check AniList for upcoming/airing releases for all anime groups.")
    parser.add_argument("--write", action="store_true", help="Write changes to data/data.json.")
    parser.add_argument("--dry-run", action="store_true", help="Print planned changes without writing. This is the default.")
    parser.add_argument("--delay", type=float, default=1.0, help="Seconds to wait between AniList requests.")
    parser.add_argument("--retries", type=int, default=3, help="Retries for AniList rate-limit responses.")
    parser.add_argument("--retry-delay", type=float, default=8.0, help="Base seconds to wait before retrying a rate-limited request.")
    parser.add_argument("--deep", action="store_true", help="Also search every existing item title. Slower, for manual audits.")
    args = parser.parse_args()

    try:
        data = load_data()
        report = apply_updates(data, max(args.delay, 0), args.deep, max(args.retries, 0), max(args.retry_delay, 0))
        if args.write:
            save_data(data)
        print(json.dumps({"mode": "write" if args.write else "dry-run", **report}, indent=2, ensure_ascii=False))
        return 1 if report["errors"] else 0
    except (OSError, RuntimeError, json.JSONDecodeError) as exc:
        print(f"Anime release check failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

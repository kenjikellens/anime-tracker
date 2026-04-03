"""
RASCAL / Anime Tracker Data Auditor

Controleert de lokale databronnen op:
1) Duplicaten
2) 3-lagen structuur (anime/franchise -> reeks -> aflevering)
3) Dataconsistentie tussen data.json, data.js en docs/te_bekijken.md
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from collections import Counter

ROOT = Path(__file__).resolve().parent
DATA_JSON = ROOT / "data.json"
DATA_JS = ROOT / "data.js"
TE_BEKIJKEN_MD = ROOT / "docs" / "te_bekijken.md"

EPISODIC_TYPES = {"tv", "series", "ova", "ona"}
FILM_TYPES = {"movie", "film"}
KNOWN_TYPES = EPISODIC_TYPES | FILM_TYPES


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def extract_titles_from_data_js(path: Path):
    if not path.exists():
        return []
    content = path.read_text(encoding="utf-8")
    return re.findall(r'title:\s*["\'](.*?)["\']', content)


def extract_titles_from_markdown(path: Path):
    if not path.exists():
        return []
    lines = path.read_text(encoding="utf-8").splitlines()
    return [re.sub(r"^-\s*", "", line.strip()) for line in lines if line.strip().startswith("- ")]


def is_non_empty_episodes(item):
    seasons = item.get("seasons")
    if not seasons:
        return False
    return any((season.get("episodes") or []) for season in seasons)


def audit():
    print("--- Start Data Audit ---")

    if not DATA_JSON.exists():
        print(f"ERROR: {DATA_JSON} bestaat niet.")
        return

    data_json = load_json(DATA_JSON)
    titles_json = [item.get("title", "") for item in data_json if isinstance(item, dict)]

    # 1) Duplicate check
    counts = Counter(titles_json)
    duplicates = [title for title, count in counts.items() if title and count > 1]
    if duplicates:
        print(f"DUPLICATES: {len(duplicates)} unieke duplicate titels gevonden.")
        print(f"Samples: {duplicates[:10]}")
    else:
        print("OK: Geen duplicate titels in data.json.")

    # 2) 3-lagen checks
    type_missing = []
    unknown_type = []
    episodic_without_episodes = []
    films_without_status = []

    for item in data_json:
        if not isinstance(item, dict):
            continue

        title = item.get("title", "<zonder titel>")
        item_type = (item.get("type") or "").strip().lower()

        if not item_type:
            type_missing.append(title)
            continue

        if item_type not in KNOWN_TYPES:
            unknown_type.append((title, item_type))

        if item_type in EPISODIC_TYPES and not is_non_empty_episodes(item):
            episodic_without_episodes.append(title)

        if item_type in FILM_TYPES and item.get("status") not in {-1, 0, 1, 2}:
            films_without_status.append(title)

    print("\n[3-LAGEN STRUCTUUR]")
    print(f"Items gecontroleerd: {len(data_json)}")
    print(f"Type ontbreekt: {len(type_missing)}")
    if type_missing:
        print(f"  Samples: {type_missing[:10]}")

    print(f"Onbekend type: {len(unknown_type)}")
    if unknown_type:
        print(f"  Samples: {unknown_type[:10]}")

    print(f"Episodisch type zonder afleveringen: {len(episodic_without_episodes)}")
    if episodic_without_episodes:
        print(f"  Samples: {episodic_without_episodes[:10]}")

    print(f"Filmtype zonder geldige item-status: {len(films_without_status)}")
    if films_without_status:
        print(f"  Samples: {films_without_status[:10]}")

    # 3) Cross-source checks
    unique_titles = set(titles_json)
    titles_js = extract_titles_from_data_js(DATA_JS)
    titles_md = extract_titles_from_markdown(TE_BEKIJKEN_MD)

    missing_from_json_js = [t for t in titles_js if t not in unique_titles]
    missing_from_json_md = [t for t in titles_md if t not in unique_titles]

    print("\n[CROSS-SOURCE]")
    print(f"In data.js maar niet in data.json: {len(missing_from_json_js)}")
    if missing_from_json_js:
        print(f"  Samples: {missing_from_json_js[:10]}")

    print(f"In te_bekijken.md maar niet in data.json: {len(missing_from_json_md)}")
    if missing_from_json_md:
        print(f"  Samples: {missing_from_json_md[:10]}")

    print("--- Audit klaar ---")


if __name__ == "__main__":
    audit()

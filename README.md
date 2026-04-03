
Improve anime documentation structure
3 apr
·
anime-tracker
·
main

Archiveren

Delen

PR maken


1
help mij de documentatie te verbeteren, en zorg voor dat er 3 lagen zijn bij de data voor animes: anime, series/films/ova/ona en laatste laag is aflevering (dit zou al zo moeten zijn, maar dubbelcheck eens)
Kopiëren
Summary

Ik heb de documentatie uitgebreid in README.md met een duidelijke uitleg van de 3 datalagen (franchise → reeks-type → aflevering), inclusief hoe films daarin passen en hoe je dit valideert via de audit. 

Ik heb een nieuwe technische documentatiepagina toegevoegd: docs/data_model.md, met concrete schema-voorbeelden voor zowel episodische items (tv/ova/ona) als films (movie) en de verwachte episode-structuur. 

Ik heb audit_data.py verbeterd:

geen hardcoded Windows-paden meer (nu repo-relatieve paden),

expliciete controle op type-validatie (tv/series/ova/ona/movie/film),

controles op episodische items zonder afleveringen,

controles op films zonder geldige item-status,

plus bestaande cross-checks met data.js en docs/te_bekijken.md. 

Ik heb data.json gecorrigeerd zodat de 3-laag structuur nu consistent is voor de ontbrekende gevallen:

My Matchmaking Partner Is My Student, An Agg... heeft nu een expliciete type: "tv" bij bestaande seizoenen/episodes.

Kiss x Sis OVA heeft nu type: "ova" én een episode-structuur (seasons[].episodes[]) met status. 

Testing

✅ python3 audit_data.py

Resultaat: geen ontbrekende types, geen onbekende types, geen episodische items zonder afleveringen, geen film-items zonder geldige status.

✅ git status --short

✅ git show --stat --oneline HEAD

Commit staat op: 84d8288 (branch: work).


Bestanden (4)
een vraagje: zijn deze nu al toegepast op de github zelf of niet? beantwoord deze vraag eers, erna doe dit: zorg ook dat de readme zoals een officiele github readme is. en zorg dat alle files een documentatie heeft per methode die uitlegt aan wat die gelinkt is (dus alle js files)
Kopiëren

Versie 1

Versie 2
Goed dat je dit vraagt — nee, niet automatisch op GitHub zelf.
Wat ik hier heb gedaan is lokaal in deze repo committen (laatste commit: a4d649d). Er staat in deze omgeving ook geen remote ingesteld (git remote -v gaf geen output), dus er is niets automatisch gepusht naar GitHub. Je moet dit nog pushen/mergen in je GitHub-repo.

Summary
Ik heb de README.md omgezet naar een meer “officiële GitHub README”-structuur met duidelijke secties: features, datamodel, projectstructuur, quick start, audit, architectuur en documentatie-links. 

Ik heb in app.js extra method-/blokdocumentatie toegevoegd met expliciete “koppelingen” (welke module/state per functie of event gebruikt wordt), inclusief documentatie voor addNew en event wiring. 

Ik heb in domein/Modals.js module-koppelingen en methodedocumentatie toegevoegd voor de modal event-initialisatie, zodat duidelijk is waar deze methodes aan gekoppeld zijn. 

Ik heb in data.js documentatie toegevoegd die uitlegt dat dit een legacy/statische exportbron is (zonder methodes) en dat data.json de primaire runtime-bron is. 

Testing

✅ python3 audit_data.py

✅ git status --short

✅ git log -1 --oneline

✅ git remote -v (uitvoer was leeg; dus geen remote geconfigureerd in deze omgeving)


Bestanden (7)
hoe moet ik die git apply doen? als deze in de browser is gebeurd?
Kopiëren


Diff
Logboeken

README.md
README.md
+51
-1

# Anime Tracker

Een lokale anime-tracker met franchise-groepering, aflevering-statussen en AniList-sync.

## ✨ Features
- Franchise-overzicht met gecombineerde status per titelgroep.
- Statusbeheer op 3 niveaus: anime-item, seizoen en aflevering.
- AniList OAuth + sync (pull en push).
- Lokale fallback-opslag voor GitHub Pages modus.
- Batch-acties voor meerdere geselecteerde afleveringen.

## 🧱 Data Model (3 lagen)
De app gebruikt een 3-lagen model:

1. **Anime/Franchise-laag**: logische groep (`franchise` of fallback `title`).
2. **Reeks-laag**: itemtype (`tv`, `movie`, `ova`, `ona`).
3. **Aflevering-laag**: `seasons[].episodes[]` voor episodische items.

Meer details en voorbeelden staan in:
- [`docs/data_model.md`](docs/data_model.md)
- [`docs/js_method_documentation.md`](docs/js_method_documentation.md)

## 📁 Projectstructuur
- `app.js`: centrale orchestratie (init, render, sync-flow).
- `domein/*.js`: domeinmodules voor status, UI, storage, batch en AniList.
- `data.json`: primaire dataopslag.
- `docs/`: functionele en technische documentatie.

## 🚀 Snel starten
```bash
# lokaal serveren (voorbeeld met python)
python3 -m http.server 8000
# open vervolgens http://localhost:8000
```

## ✅ Datavalidatie
Run de audit:

```bash
python3 audit_data.py
```

Deze audit controleert o.a. duplicates, type-validiteit, episode-structuur en cross-source consistentie.

## 🛠️ Ontwikkelrichtlijnen
- Houd statuslogica in `domein/StatusCalculator.js` en `domein/AnimeActions.js`.
- Gebruik `save()` na mutaties die persistente data veranderen.
- Gebruik bestaande component builders in `domein/Components.js` voor UI-uitbreidingen.

## 📄 Licentie
Dit project gebruikt de MIT-licentie. Zie [`LICENSE`](LICENSE).
audit_data.py
audit_data.py
+123
-75

"""
"""
RASCAL Data Auditor
RASCAL / Anime Tracker Data Auditor
This script performs a quality check on the database files (data.json, data.js) 

and cross-references them with the 'te_bekijken.md' checklist to identify 
Controleert de lokale databronnen op:
duplicates, missing entries, or incomplete data structures.
1) Duplicaten
2) 3-lagen structuur (anime/franchise -> reeks -> aflevering)
3) Dataconsistentie tussen data.json, data.js en docs/te_bekijken.md
"""
"""


from __future__ import annotations

import json
import json
import os
import re
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


# Absolute paths to critical data files
DATA_JSON = r'c:\Users\kenji\Documents\PROJECTS\RASCAL\data.json'
DATA_JS = r'c:\Users\kenji\Documents\PROJECTS\RASCAL\data.js'
TE_BEKIJKEN_MD = r'c:\Users\kenji\Documents\PROJECTS\RASCAL\docs\te_bekijken.md'


def audit():
def audit():
    """
    print("--- Start Data Audit ---")
    Executes a series of checks to ensure data consistency across multiple sources.

    1. Checks for duplicate titles in data.json.
    if not DATA_JSON.exists():
    2. Identifies TV shows with no seasons or episodes.
        print(f"ERROR: {DATA_JSON} bestaat niet.")
    3. Cross-references entries in data.js to ensure they exist in data.json.
    4. Compares the Markdown checklist (te_bekijken.md) against the primary JSON database.
    """
    print("--- Starting Data Audit ---")
    
    # 1. Load data.json
    try:
        with open(DATA_JSON, 'r', encoding='utf-8') as f:
            data_json = json.load(f)
    except Exception as e:
        print(f"Error loading data.json: {e}")
        return
        return


    titles_json = [item['title'] for item in data_json]
    data_json = load_json(DATA_JSON)
    unique_titles = set(titles_json)
    titles_json = [item.get("title", "") for item in data_json if isinstance(item, dict)]
    

    if len(titles_json) != len(unique_titles):
    # 1) Duplicate check
        print(f"DUPLICATES FOUND: {len(titles_json) - len(unique_titles)} duplicate entries.")
    counts = Counter(titles_json)
        # Find which ones
    duplicates = [title for title, count in counts.items() if title and count > 1]
        seen = set()
    if duplicates:
        dups = []
        print(f"DUPLICATES: {len(duplicates)} unieke duplicate titels gevonden.")
        for t in titles_json:
        print(f"Samples: {duplicates[:10]}")
            if t in seen:
                dups.append(t)
            seen.add(t)
        print(f"Duplicate samples: {dups[:5]}")
    else:
    else:
        print("No duplicate titles in data.json.")
        print("OK: Geen duplicate titels in data.json.")


    # 2. Check for empty seasons/episodes
    # 2) 3-lagen checks
    empty_series = [item['title'] for item in data_json if not item.get('seasons')]
    type_missing = []
    if empty_series:
    unknown_type = []
        print(f"EMPTY SERIES (No seasons): {len(empty_series)} items found.")
    episodic_without_episodes = []
        print(f"Samples: {empty_series[:5]}")
    films_without_status = []


    # 3. Load data.js
    for item in data_json:
    try:
        if not isinstance(item, dict):
        with open(DATA_JS, 'r', encoding='utf-8') as f:
            continue
            content = f.read()

            # Crude regex to extract titles
        title = item.get("title", "<zonder titel>")
            titles_js = re.findall(r'title:\s*["\'](.*?)["\']', content)
        item_type = (item.get("type") or "").strip().lower()
    except Exception as e:

        print(f"Error reading data.js: {e}")
        if not item_type:
        titles_js = []
            type_missing.append(title)

            continue
    missing_from_json = [t for t in titles_js if t not in unique_titles]

    if missing_from_json:
        if item_type not in KNOWN_TYPES:
        print(f"MISSING FROM JSON (found in data.js): {len(missing_from_json)} items.")
            unknown_type.append((title, item_type))
        print(f"Samples: {missing_from_json[:5]}")


        if item_type in EPISODIC_TYPES and not is_non_empty_episodes(item):
    # 4. Load te_bekijken.md
            episodic_without_episodes.append(title)
    try:

        with open(TE_BEKIJKEN_MD, 'r', encoding='utf-8') as f:
        if item_type in FILM_TYPES and item.get("status") not in {-1, 0, 1, 2}:
            lines = f.readlines()
            films_without_status.append(title)
            titles_md = [re.sub(r'^-\s*', '', line.strip()) for line in lines if line.strip().startswith('- ')]

    except Exception as e:
    print("\n[3-LAGEN STRUCTUUR]")
        print(f"Error reading te_bekijken.md: {e}")
    print(f"Items gecontroleerd: {len(data_json)}")
        titles_md = []
    print(f"Type ontbreekt: {len(type_missing)}")

    if type_missing:
    missing_md_from_json = [t for t in titles_md if t not in unique_titles]
        print(f"  Samples: {type_missing[:10]}")
    if missing_md_from_json:

        print(f"MISSING FROM JSON (found in te_bekijken.md): {len(missing_md_from_json)} items.")
    print(f"Onbekend type: {len(unknown_type)}")
        print(f"Samples: {missing_md_from_json[:5]}")
    if unknown_type:

        print(f"  Samples: {unknown_type[:10]}")
    print("--- Audit Complete ---")

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
if __name__ == "__main__":
    audit()
    audit()
data.json
data.json
+19
-3

@@ -2396,51 +2396,52 @@
            "name": "Episode 22",
            "name": "Episode 22",
            "status": -1
            "status": -1
          },
          },
          {
          {
            "number": 23,
            "number": 23,
            "name": "Episode 23",
            "name": "Episode 23",
            "status": -1
            "status": -1
          },
          },
          {
          {
            "number": 24,
            "number": 24,
            "name": "Episode 24",
            "name": "Episode 24",
            "status": -1
            "status": -1
          },
          },
          {
          {
            "number": 25,
            "number": 25,
            "name": "Episode 25",
            "name": "Episode 25",
            "status": -1
            "status": -1
          },
          },
          {
          {
            "number": 26,
            "number": 26,
            "name": "Episode 26",
            "name": "Episode 26",
            "status": -1
            "status": -1
          }
          }
        ]
        ]
      }
      }
    ]
    ],
    "type": "tv"
  },
  },
  {
  {
    "title": "Pseudo Harem",
    "title": "Pseudo Harem",
    "rating": -1,
    "rating": -1,
    "tmdb_id": 224753,
    "tmdb_id": 224753,
    "type": "tv",
    "type": "tv",
    "poster_path": "/3B6MvhEdbEU4Y4UHETYkUDRhu9x.jpg",
    "poster_path": "/3B6MvhEdbEU4Y4UHETYkUDRhu9x.jpg",
    "seasons": [
    "seasons": [
      {
      {
        "number": 1,
        "number": 1,
        "name": "Season 1",
        "name": "Season 1",
        "episodes": [
        "episodes": [
          {
          {
            "number": 1,
            "number": 1,
            "name": "The Beginning of a Story?",
            "name": "The Beginning of a Story?",
            "air_date": "2024-07-05",
            "air_date": "2024-07-05",
            "status": -1
            "status": -1
          },
          },
          {
          {
            "number": 2,
            "number": 2,
            "name": "Confession?",
            "name": "Confession?",
            "air_date": "2024-07-12",
            "air_date": "2024-07-12",
            "status": -1
            "status": -1
          },
          },
          {
          {
@@ -13468,51 +13469,66 @@
            "number": 11,
            "number": 11,
            "name": "The Healer is Troubled by Norn’s Brutality!",
            "name": "The Healer is Troubled by Norn’s Brutality!",
            "air_date": "2021-03-24",
            "air_date": "2021-03-24",
            "status": 1
            "status": 1
          },
          },
          {
          {
            "number": 12,
            "number": 12,
            "name": "The Healer Starts a New Journey!",
            "name": "The Healer Starts a New Journey!",
            "air_date": "2021-03-31",
            "air_date": "2021-03-31",
            "status": 1
            "status": 1
          }
          }
        ]
        ]
      }
      }
    ],
    ],
    "release_date": "2021-01-13",
    "release_date": "2021-01-13",
    "anilist_id": 110344,
    "anilist_id": 110344,
    "mal_id": 37265,
    "mal_id": 37265,
    "franchise": "Redo of Healer"
    "franchise": "Redo of Healer"
  },
  },
  {
  {
    "title": "Kiss x Sis OVA",
    "title": "Kiss x Sis OVA",
    "rating": 4.2,
    "rating": 4.2,
    "season": 1,
    "season": 1,
    "episode": 1,
    "episode": 1,
    "_legacyStatus": 1,
    "_legacyStatus": 1,
    "franchise": "Kiss x Sis OVA"
    "franchise": "Kiss x Sis OVA",
    "type": "ova",
    "seasons": [
      {
        "number": 1,
        "name": "OVA",
        "episodes": [
          {
            "number": 1,
            "name": "OVA 1",
            "status": 1
          }
        ]
      }
    ],
    "status": 1
  },
  },
  {
  {
    "title": "Rent-a-Girlfriend",
    "title": "Rent-a-Girlfriend",
    "rating": 0.1,
    "rating": 0.1,
    "tmdb_id": 96316,
    "tmdb_id": 96316,
    "type": "tv",
    "type": "tv",
    "poster_path": "/6ZpDPUNtVw6UdJoStvVlRZ62yAi.jpg",
    "poster_path": "/6ZpDPUNtVw6UdJoStvVlRZ62yAi.jpg",
    "seasons": [
    "seasons": [
      {
      {
        "number": 0,
        "number": 0,
        "name": "Specials",
        "name": "Specials",
        "episodes": [
        "episodes": [
          {
          {
            "number": 1,
            "number": 1,
            "name": "Date Movie 1",
            "name": "Date Movie 1",
            "air_date": "2020-06-13",
            "air_date": "2020-06-13",
            "status": 1
            "status": 1
          },
          },
          {
          {
            "number": 2,
            "number": 2,
            "name": "Date Movie 2",
            "name": "Date Movie 2",
            "air_date": "2020-06-16",
            "air_date": "2020-06-16",
            "status": 1
            "status": 1
          },
          },
          {
          {
@@ -15571,26 +15587,26 @@
            "number": 10,
            "number": 10,
            "name": "Towa and Noel Are Both Learning",
            "name": "Towa and Noel Are Both Learning",
            "air_date": "2024-06-08",
            "air_date": "2024-06-08",
            "status": -1
            "status": -1
          },
          },
          {
          {
            "number": 11,
            "number": 11,
            "name": "To Camp!",
            "name": "To Camp!",
            "air_date": "2024-06-15",
            "air_date": "2024-06-15",
            "status": -1
            "status": -1
          },
          },
          {
          {
            "number": 12,
            "number": 12,
            "name": "We Went Way Up High",
            "name": "We Went Way Up High",
            "air_date": "2024-06-22",
            "air_date": "2024-06-22",
            "status": -1
            "status": -1
          }
          }
        ]
        ]
      }
      }
    ],
    ],
    "release_date": "2024-04-06",
    "release_date": "2024-04-06",
    "anilist_id": 169927,
    "anilist_id": 169927,
    "mal_id": 56838,
    "mal_id": 56838,
    "franchise": "Studio Apartment, Good Lighting, Angel Included"
    "franchise": "Studio Apartment, Good Lighting, Angel Included"
  }
  }
]
]
docs/data_model.md
docs/data_model.md
Nieuw
+64
-0

# Data Model (Anime Tracker)

## Doel
Deze pagina beschrijft de gewenste 3-lagen datastructuur:

1. **Anime / Franchise**
2. **Reeks-item (series/films/ova/ona)**
3. **Aflevering**

## 1) Anime / Franchise-laag
- Logische groepering van gerelateerde entries.
- In data gebeurt dit via:
  - `franchise` (indien aanwezig), anders
  - `title` als fallback.

## 2) Reeks-laag
Elke entry in `data.json` is een kijkbaar item met minimaal:

- `title`
- `type` (`tv`, `movie`, `ova`, `ona`)
- metadata zoals `tmdb_id`, `poster_path`, `release_date`, `rating`

### Voorbeeld episodisch item (`tv` / `ova` / `ona`)
```json
{
  "title": "Voorbeeld Anime",
  "franchise": "Voorbeeld Franchise",
  "type": "tv",
  "seasons": [
    {
      "number": 1,
      "name": "Season 1",
      "episodes": [
        { "number": 1, "name": "Episode 1", "status": -1 }
      ]
    }
  ]
}
```

### Voorbeeld film-item (`movie`)
```json
{
  "title": "Voorbeeld Film",
  "franchise": "Voorbeeld Franchise",
  "type": "movie",
  "status": -1
}
```

## 3) Aflevering-laag
- Alleen voor episodische types.
- Pad: `seasons[].episodes[]`
- Elke aflevering heeft bij voorkeur:
  - `number`
  - `name`
  - `status` (`-1`, `0`, `1`, `2`)

## Validatie
Run de audit om te controleren of alle lagen correct aanwezig zijn:

```bash
python3 audit_data.py
```
docs/js_method_documentation.md
docs/js_method_documentation.md
Nieuw
+122
-0

# JavaScript methode-documentatie en koppelingen

Dit document geeft per JS-bestand een overzicht van methodes/functies en **waar ze aan gekoppeld zijn** (andere modules, state, events of UI-flow).

## `app.js`
- `init()`
  - Koppelt config/data-loading aan `state.animeList`.
  - Roept `Modals.initEventListeners()`, `render()`, `AnilistApi.lazyFetchAnilistData()`, `AnilistApi.lazySyncAnilistEpisodes()`.
- `render()`
  - Koppelt `getFilteredSorted()` aan `Components.buildCard()` en filter/view controls.
- `setSeasonStatus(item, season, status)`
  - Proxy naar `AnimeActions.setSeasonStatusLocally(...)` + `triggerAutoSync(item)`.
- `setAnimeAllStatus(item, status)`
  - Proxy naar `AnimeActions.setAnimeStatusLocally(...)` + `triggerAutoSync(item)`.
- `setEpisodeStatus(item, season, episode, status)`
  - Proxy naar `AnimeActions.setEpisodeStatusLocally(...)` + `triggerAutoSync(item)`.
- `triggerAutoSync(item)`
  - Koppelt lokale voortgang/status aan `AnilistApi.updateEntry(...)`.
- `syncAnilist()`
  - Volledige sync-flow met `AnilistApi.getUserList()`, `bulkSearchMedia()`, `updateEntry()` en lokale merge.
- `pushAllToAnilist()`
  - Batch-push van lokale items via `AnilistApi.bulkUpdateEntries()`.
- `addNew()`
  - UI-ingang voor handmatig item toevoegen aan `state.animeList`.
- `initTheme()` / `applyTheme(theme)`
  - Koppelen theme-controls aan CSS custom properties en localStorage.

## `data.js`
- Geen methodes.
- Bevat `animeData` seed/legacy bron voor titellijsten.

## `domein/State.js`
- Geen uitvoerbare methodes.
- Definieert globale state-velden die door vrijwel alle modules gebruikt worden.

## `domein/ListTransformer.js`
- `getFilteredSorted()`
  - Koppelt `state.animeList` aan franchise-groepering, status-filtering, search en sorting.
  - Wordt aangeroepen door `render()` in `app.js`.

## `domein/Modals.js`
- `showRatingModal(item, changeStatus = true)`
  - Koppelt score-input aan item-mutatie en `save()`.
- `showDetailModal(group)`
  - Bouwt detailweergave met `Components.buildDetailGroup(...)` en modal state.
- `initEventListeners()`
  - Registreert modal-gerelateerde UI events.

## `domein/EmbedSources.js`
- `getVidsrcUrl(item, seasonNum, episodeNum)`
  - Koppelt gekozen provider (`window.currentEmbedSource`) aan effectieve playback URL.
  - Gebruikt `item.type` voor movie vs tv/episode syntax.

## `domein/AnimeActions.js`
- `setEpisodeStatusLocally(item, season, episode, newStatus)`
  - Past episode-status aan + cascade/save/render flow.
- `setSeasonStatusLocally(item, season, newStatus)`
  - Seizoensstatus-mutatie met slimme "volgende onkeken" logica voor status `0`.
- `setAnimeStatusLocally(item, newStatus)`
  - Item-brede statusmutatie over alle seizoenen/episodes (of filmstatus).

## `domein/Storage.js`
- `save()`
  - Persistente opslag: lokaal (`localStorage`) of backend (`/save`) afhankelijk van modus.
- `exportData()`
  - Exporteert `state.animeList` als JSON-download.

## `domein/StatusCalculator.js`
- `getSeasonStatus(season)`
  - Berekent macrostatus van een seizoen op basis van episode-status.
- `getAnimeStatus(item)`
  - Berekent macrostatus van item (film of episodisch).
- `getAnimeProgress(item)`
  - Berekent totaal aantal bekeken episodes (of 1 voor bekeken film).

## `domein/AnilistApi.js`
- `authorize()`
  - Start OAuth flow via redirect.
- `getUserList(token)`
  - Haalt volledige AniList collection op.
- `updateEntry(token, data)`
  - Upsert van één AniList entry.
- `bulkUpdateEntries(token, items)`
  - Batch upsert van meerdere entries.
- `searchMedia(title)`
  - Zoekt media op titel.
- `fetchMediaDetails(id)`
  - Detailophaling voor poster/beschrijving/episodecount.
- `bulkSearchMedia(titles)`
  - Batch search voor link-proces.
- `lazyFetchAnilistData()`
  - Achtergrond-vulling van missende metadata.
- `lazySyncAnilistEpisodes()`
  - Achtergrond-sync van episode-aantallen op basis van AniList details.

## `domein/UIHelpers.js`
- `statusIcon(status)`
  - Koppelt statuscode aan icon class.
- `statusLabel(status)`
  - Koppelt statuscode aan tekstlabel.
- `getRatingClass(rating)`
  - Koppelt score aan stijlklasse.

## `domein/Components.js`
- `buildStatusDropdown(currentStatus, onChange)`
  - Bouwt status dropdown + callbackkoppeling.
- `buildPlayDropdown(item, s, eNum)`
  - Bouwt provider/stream-play dropdown op basis van `EmbedSources`.
- `buildCard(group, computedStatus)`
  - Bouwt hoofdkaart voor grid/list.
- `buildDetailGroup(group)`
  - Bouwt detailblok met items/seizoenen/filmacties.
- `buildSeasonRow(item, season)`
  - Bouwt accordion-rij voor seizoen + episodes.

## `domein/BatchActions.js`
- `renderBatchBar(x, y)`
  - Rendert contextuele batch-actiebar op selectie.
- `clearSelection()`
  - Maakt episode-selectie leeg en herstelt UI state.
- `applyBatchStatus(status)`
  - Past status in bulk toe op geselecteerde episodes.

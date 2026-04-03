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

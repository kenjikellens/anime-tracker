# Data Model

## Doel
Deze pagina beschrijft het runtime-datamodel van RASCAL en de velden waar de JavaScript-modules op rekenen.

## Lagen
1. Franchise-laag
2. Item-laag
3. Aflevering-laag

## Franchise-laag
De UI groepeert records op:
- `franchise` als die aanwezig is
- anders `title`

De groepering gebeurt pas in runtime in `domein/ListTransformer.js`. `data.json` blijft dus primair een platte lijst van items.

## Item-laag
Elk item in `data.json` hoort minimaal te hebben:
- `title`
- `type`
- `rating`

Veelvoorkomende extra velden:
- `franchise`
- `poster_path`
- `tmdb_id`
- `anilist_id`
- `mal_id`
- `description`
- `release_date`
- `_legacyStatus`

### Film-item
Voor films wordt status direct op itemniveau bijgehouden.

```json
{
  "title": "Voorbeeld Film",
  "type": "movie",
  "status": -1,
  "rating": -1
}
```

### Episodisch item
Voor `tv`, `ova` en `ona` hoort de status op afleveringsniveau te zitten.

```json
{
  "title": "Voorbeeld Serie",
  "franchise": "Voorbeeld Franchise",
  "type": "tv",
  "rating": -1,
  "seasons": [
    {
      "number": 1,
      "name": "Season 1",
      "episodes": [
        {
          "number": 1,
          "name": "Episode 1",
          "status": -1
        }
      ]
    }
  ]
}
```

## Aflevering-laag
Per aflevering verwacht de app:
- `number`
- `name`
- `status`

Geldige statuswaarden:
- `-1`: te bekijken
- `0`: bezig
- `1`: bekeken

## Migraties en normalisatie
Bij het laden voert `app.js` een lichte normalisatie uit:
- lege of ontbrekende ratings worden `-1`
- ongeldige statuswaarden vallen terug op veilige defaults
- ontbrekende `seasons` bij episodische items worden een lege array
- oude item-status op episodische items verhuist naar `_legacyStatus`

## Waarom dit belangrijk is
De runtime verwacht deze structuur in:
- `domein/StatusCalculator.js`
- `domein/AnimeActions.js`
- `domein/Components.js`
- `domein/Modals.js`
- `domein/AnilistApi.js`

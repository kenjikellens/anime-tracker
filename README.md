# Anime Tracker

Een lokale anime-tracker met franchise-groepering, afleveringstatussen en AniList-sync.

## Features
- Franchise-overzicht met gecombineerde status per titelgroep.
- Statusbeheer op drie niveaus: anime-item, seizoen en aflevering.
- AniList OAuth plus sync in beide richtingen.
- Lokale fallback-opslag voor GitHub Pages modus.
- Batch-acties voor meerdere geselecteerde afleveringen.

## Data Model
De app gebruikt een 3-lagen model:

1. Anime- of franchise-laag: logische groep via `franchise` of fallback `title`.
2. Reeks-laag: itemtype zoals `tv`, `movie`, `ova` of `ona`.
3. Aflevering-laag: `seasons[].episodes[]` voor episodische items.

Meer details en voorbeelden staan in:
- [`docs/data_model.md`](docs/data_model.md)
- [`docs/js_method_documentation.md`](docs/js_method_documentation.md)

## Projectstructuur
- `app.js`: centrale orchestratie voor init, render en sync-flow.
- `domein/*.js`: domeinmodules voor status, UI, opslag, batchacties en AniList.
- `data.json`: primaire databron.
- `docs/`: functionele en technische documentatie.

## Snel starten
```bash
python START_UP.py
```

Open daarna [http://localhost:3000](http://localhost:3000).

## Datavalidatie
Run de audit:

```bash
python audit_data.py
```

Deze audit controleert onder meer duplicates, type-validiteit, episode-structuur en cross-source consistentie.

## Ontwikkelrichtlijnen
- Houd statuslogica in `domein/StatusCalculator.js` en `domein/AnimeActions.js`.
- Gebruik `save()` na mutaties die persistente data wijzigen.
- Gebruik bestaande component builders in `domein/Components.js` voor UI-uitbreidingen.
- Voeg bij nieuwe logica JSDoc toe als de intentie niet direct uit de code blijkt.

## Licentie
Dit project gebruikt de MIT-licentie. Zie [`LICENSE`](LICENSE).

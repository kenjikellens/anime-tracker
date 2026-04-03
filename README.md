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

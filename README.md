# Anime Tracker

Een modulaire anime tracker (vanille JS + Python backend optie) met franchise-groepering, seizoens/aflevering-statussen en AniList-synchronisatie.

## ✨ Features

- **Franchise-overzicht** met gecombineerde status per titelgroep.
- **Status tracking per niveau**:
  - itemniveau (film),
  - seizoen,
  - aflevering.
- **AniList integratie**:
  - OAuth login,
  - status/progress push,
  - bulk sync,
  - background metadata verrijking.
- **UI functies**:
  - grid/list weergave,
  - filteren + zoeken + sorteren,
  - thema-switcher,
  - batch status-acties via multi-select.
- **Databeheer**:
  - lokale save/export flow (GitHub mode),
  - backend `/save` flow (lokale Python mode).

## 🧱 Data Model (3 lagen)

De applicatie gebruikt een 3-lagen model voor anime-data:

1. **Anime/Franchise-laag**
   - Groepering via `franchise` (of `title` als fallback).
2. **Reeks-laag**
   - Eén item per reeks/type (`tv`, `movie`, `ova`, `ona`).
3. **Aflevering-laag**
   - Voor episodische items: `seasons[].episodes[]`.
   - Voor films: item-level `status`.

Meer details en voorbeelden: [`docs/data_model.md`](docs/data_model.md).

## 📁 Projectstructuur

```text
.
├── app.js                  # Centrale controller + event wiring
├── data.json               # Primaire dataset
├── domein/                 # Domeinmodules (state, UI, API, actions)
├── docs/                   # Functionele documentatie
├── START_UP.py             # Lokale opstart/backend helper
└── audit_data.py           # Datavalidatie/audit-script
```

## 🚀 Snel starten

### Optie A: lokaal met Python backend

```bash
python3 START_UP.py
```

Open daarna de URL die het script toont (meestal `http://localhost:3000`).

### Optie B: statisch/GitHub mode

Open `index.html` in een statische hostomgeving. In deze mode schrijft de app naar `localStorage` en kun je via **Export** een nieuwe `data.json` downloaden.

## 🔍 Datacontrole

Run de audit om je dataset te valideren:

```bash
python3 audit_data.py
```

De audit checkt onder andere:

- duplicate titels,
- missende/ongeldige `type` waarden,
- episodische items zonder episodes,
- filmitems zonder geldige status,
- verschillen tussen `data.json`, `data.js` en `docs/te_bekijken.md`.

## 🧩 Architectuur-overzicht

Belangrijkste modules in `domein/`:

- `State.js` – globale state + UI voorkeuren.
- `ListTransformer.js` – filter/sort/group pipeline.
- `StatusCalculator.js` – afgeleide status/progress berekening.
- `AnimeActions.js` – mutaties van item/seizoen/aflevering-status.
- `Components.js` – herbruikbare UI builders.
- `Modals.js` – detail/rating modalflow.
- `AnilistApi.js` – AniList GraphQL + sync helpers.
- `Storage.js` – persist/export gedrag per runtime mode.

## 📝 Documentatie

- Datamodel: [`docs/data_model.md`](docs/data_model.md)
- UI regels: [`docs/ui_specs.md`](docs/ui_specs.md)
- Ideeën/backlog: [`docs/suggestions.md`](docs/suggestions.md)

---

Als je wil, kan ik hierna ook een **API/Module Reference** toevoegen in `docs/` met alle publieke functies per bestand.

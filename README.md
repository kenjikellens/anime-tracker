# 🐾 RASCAL - Robust Anime & Series Collection Analysis Layer

RASCAL is een krachtige, lokaal-georiënteerde anime-tracker ontworpen voor gebruikers die volledige controle willen over hun data, gecombineerd met de modernste synchronisatie-opties. Het biedt een unieke hiërarchische weergave van franchises en seizoenen, direct vanuit een simpel `data.json` bestand.

![RASCAL Preview](resources/preview.png) *(Placeholder voor screenshot)*

---

## 🔥 Belangrijkste Features

- **📂 Franchise Groepering**: Automatische bundeling van verschillende seizoenen, films en OVA's onder één franchise-hoofdstuk voor een opgeruimd overzicht.
- **🔄 AniList Tweerichtings-Sync**: Volledige OAuth-integratie. Update je lokale lijst vanaf AniList of push je lokale voortgang met één klik terug.
- **⚡ Batch Acties**: Selecteer meerdere afleveringen tegelijkertijd om ze als bekeken te markeren of te resetten.
- **📊 3-Lagen Statusbeheer**: Track status op het hoogste niveau (Franchise), het middenniveau (Seizoen/Item) en het fijnmazige niveau (Aflevering).
- **🎨 Dynamische UI**: Een premium interface met glas-morfisme effecten, soepele overgangen en kleurgecodeerde ratings op basis van score:
  - 🌟 **9.0 - 10.0**: Goud (#ffd700)
  - 🟢 **8.0 - 8.9**: Groen (#27ae60)
  - 🟡 **6.0 - 6.9**: Geel (#f1c40f)
  - 🔴 **4.0 - 4.9**: Rood (#e74c3c)
  - ...en meer.

---

## 🚀 Aan de slag

### 1. Lokale installatie (Aanbevolen)
RASCAL wordt geleverd met een lichtgewicht Python-backend voor automatische data-opslag en OAuth-afhandeling.

```bash
# Clone de repository
git clone https://github.com/kenjikellens/anime-tracker.git
cd anime-tracker

# Start de server
python START_UP.py
```
De app opent automatisch op [http://localhost:3000](http://localhost:3000).

### 2. GitHub Pages / Statische Modus
RASCAL werkt ook zonder backend! In deze modus kun je handmatig je `data.json` exporteren via de downloadknop in de UI.

---

## 🏗️ Technisch Datamodel

RASCAL gebruikt een specifiek hiërarchisch model in `data.json`:

1.  **Franchise-laag**: Records worden gegroepeerd op het `franchise` veld. Als dit ontbreekt, wordt de `title` als groep gebruikt.
2.  **Item-laag**: Elk item (bijv. "Season 1" of een film) bevindt zich in de hoofdarray. Hier worden metadata zoals `type` (`tv`, `movie`, `ova`), `rating` en `anilist_id` opgeslagen.
3.  **Aflevering-laag**: Voor episodische content bevat elk item een `seasons` array met `episodes`. De status wordt hier opgeslagen:
    - `-1`: Nog te kijken
    - `0`: Bezig
    - `1`: Bekeken

Zie [docs/data_model.md](docs/data_model.md) voor een volledig schema-voorbeeld.

---

## 📂 Projectstructuur

- `app.js`: De centrale motor. Regelt de initialisatie, de render-loop en de orchestratie tussen modules.
- `domein/`: Bevat de functionele kern-logica:
  - `AnilistApi.js`: Alle GraphQL interacties en OAuth flow.
  - `Components.js`: Herbruikbare UI-componenten (kaarten, dropdowns).
  - `ListTransformer.js`: De logica voor filtering, sortering en franchise-groepering.
  - `Storage.js`: Afhandeling van persistente opslag (Local vs Server).
- `styles.css`: De complete styling, inclusief de custom design-tokens.
- `audit_data.py`: Een handig script om je `data.json` te valideren op fouten of duplicates.

---

## 🛠️ Ontwikkeling & Bijdragen

Wil je meehelpen aan RASCAL? Let dan op de volgende richtlijnen:
1.  **CSS**: Gebruik vanilla CSS. Gebruik geen `translate` transformaties voor hover/focus effecten (project-specifieke regel).
2.  **JSDoc**: Documenteer complexe logica. Bekijk [docs/js_method_documentation.md](docs/js_method_documentation.md) voor een overzicht van bestaande functies.
3.  **Validatie**: Draai altijd `python audit_data.py` voordat je een commit doet om de integriteit van de data te garanderen.

---

## 📄 Licentie

Dit project is gelicenseerd onder de **MIT Licentie**. Zie het [LICENSE](LICENSE) bestand voor details.

---
*Gemaakt met ❤️ voor anime fans door Kenji Kellens.*

---
name: anime-checker
description: >-
  Controleert bijgehouden anime franchises op nieuwe seizoenen, films, OVA's, ONA's en statuswijzigingen (Airing/Upcoming). Gebruik bij /anime-checker of bij controle op updates.
---

# Anime Release Checker

Deze skill controleert anime in de database op nieuwe releases (seizoenen, films, OVA's, specials) en actuele uitzendstatussen alsook het fixen van data.

---

## Communicatiestijl & Toon
- **Natuurlijk & beknopt**: Praat in normale, heldere taal zonder stijve bureaucratische termen of robotachtige headers.
- **Duidelijk overzicht**: Toon wijzigingen of voortgang in een vlot en overzichtelijk lijstje.
- **Geen onnodige dramatiek**: Rapporteer direct wat er gevonden is of dat alles up-to-date is.

---

## 1. Belangrijke Regels & Statuscodes

### Statuscodes
* **Parent Anime** (`data/data.json`): Mag alleen kijkstatus hebben:
  * `-1` = **Te bekijken** (To Watch)
  * `0` = **Bezig met kijken** (Watching)
  * `1` = **Bekeken** (Watched)
* **Items** (`data/data.json`): Mogen zowel kijkstatus als release-status hebben:
  * `-1`, `0`, `1`
  * `2` = **Upcoming** (aangekondigd, nog niet uitgezonden)
  * `3` = **Airing** (huidig bezig met uitzenden)

### Kernregels
1. Geef een parent anime **nooit** status `2` of `3`.
2. Gebruik nooit `"New"` als statuswaarde.
3. Gebruik geen browser / DOM om wijzigingen te controleren; vraag de gebruiker om te verifiëren in de UI.
4. Gebruik altijd **Engelse titels** in `data/data.json`.
5. **Gebruik AniList API NOOIT om bestaande items of kijkvoortgang automatisch te overschrijven**: AniList API is enkel toegestaan voor metadata bij het toevoegen van een specifiek nieuw item.
6. **Bekijk eerst de bestaande data**: Lees altijd eerst het huidige anime-object in `data/data.json` om te weten wat er al in staat vóórdat je online zoekt.
7. **Sla volledig bekeken anime over**: Pas NOOIT automatisch anime aan met parent status `1` of waarvan alle items al bekeken zijn.
8. **Stap-voor-stap afhandelen**: Doorloop de lijst rustig per anime zodat data consistent blijft.

### Regels voor Airing & Upcoming items
- **Airing (status `3`)**: Het item moet `episodesCount` bevatten met het totaal aangekondigde aantal afleveringen.
- **Upcoming (status `2`)**: Het item moet `episodesCount` hebben (of `1` voor films). Indien nog onbekend, zet op `1`.

---

## 2. Stappenplan

### Stap 1: Takenlijst opstellen (`task.md`)
Maak een overzichtelijke `task.md` artifact met alle te controleren anime uit `data/data.json`. Elk item start als `[ ]` en wordt na controle gemarkeerd als `[x]`.

### Stap 2: Per anime controleren
Voor elke anime in de lijst:
1. Lees het anime-object in `data/data.json`.
2. Als status `1` is of alle items zijn bekeken: direct overslaan.
3. Zoek gericht via het web naar recente aankondigingen of nieuwe releases voor die specifieke franchise.
4. Update `data/data.json` en de bijbehorende documentatie (`docs/data/`) als er nieuwe releases of statuswijzigingen zijn.
5. Vink `[x]` af in `task.md`.

### Stap 3: Afronding en samenvatting
Geef na afloop een kort, vlot overzicht van:
- Welke nieuwe seizoenen of films zijn toegevoegd.
- Welke items een statusupdate kregen (bijv. naar Airing of Upcoming).
- Of alles up-to-date was als er niets nieuws te melden is.

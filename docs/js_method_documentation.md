# JavaScript Method Documentation

Dit document beschrijft de belangrijkste JavaScript-functies, hun verantwoordelijkheid en de koppelingen tussen modules.

## app.js

### `init()`
- Laadt config en `data.json`
- Past normalisatie en migraties toe
- Initialiseert modals en start de eerste render

### `render()`
- Vraagt de renderbare lijst op via `getFilteredSorted()`
- Bouwt statuskolommen
- Synchroniseert filter-, sorteer-, view- en size-controls met de runtime-state

### `triggerAutoSync(item)`
- Stuurt lokale status, score en voortgang naar AniList
- Gebruikt `AnilistApi.updateEntry()`

### `syncAnilist()`
- Leest de volledige AniList-collectie in
- Koppelt lokale items aan AniList-IDs
- Importeert nog ontbrekende titels
- Pushes lokale voortgang terug naar AniList

### `pushAllToAnilist()`
- Batch-push van alle gelinkte lokale items

### `addNew()`
- Voegt een nieuw item toe als de titel nog niet bestaat

## domein/State.js

### `readStoredJson(key, fallback)`
- Leest JSON veilig uit localStorage
- Voorkomt dat corrupte browserdata de app laat crashen

## domein/Storage.js

### `save()`
- Persistente opslag via localStorage of backend `/save`
- Valideert backend-response op HTTP-niveau

### `exportData()`
- Exporteert de runtime-lijst als `data.json`

### `updateDownloadButtonState(isDirty)`
- Houdt de downloadknop in sync met GitHub Pages gedrag

## domein/ListTransformer.js

### `normalizeSearchValue(value)`
- Maakt zoeken robuuster voor accenten, leestekens en hoofdletters

### `getFilteredSorted()`
- Groepeert items per franchise
- Berekent groepsstatus en groepsrating
- Past filtering, zoeken en sorteren toe

## domein/StatusCalculator.js

### `getSeasonStatus(season)`
- Berekent de macrostatus van een seizoen

### `getAnimeStatus(item)`
- Berekent de macrostatus van een item of film

### `getAnimeProgress(item)`
- Telt bekeken afleveringen of filmvoortgang

## domein/AnimeActions.js

### `setEpisodeStatusLocally(item, season, episode, newStatus)`
- Wijzigt de status van één aflevering

### `setSeasonStatusLocally(item, season, newStatus)`
- Past seizoensstatus toe op alle episodes of markeert de volgende open episode

### `setAnimeStatusLocally(item, newStatus)`
- Past itemstatus toe over alle seizoenen of op filmniveau

## domein/AnilistApi.js

### `requestAniList(query, variables, token)`
- Interne helper voor consistente GraphQL-calls

### `getUserList(token)`
- Haalt de volledige AniList-collectie op

### `updateEntry(token, data)`
- Werkt een enkele AniList-entry bij

### `bulkUpdateEntries(token, items)`
- Werkt meerdere AniList-entries in één request bij

### `searchMedia(title)`
- Zoekt AniList-media op titel

### `fetchMediaDetails(id)`
- Haalt detailmetadata op zoals poster, beschrijving en episode-count

### `bulkSearchMedia(titles)`
- Zoekt meerdere titels in één GraphQL-request

### `lazyFetchAnilistData()`
- Vult ontbrekende metadata en TMDB-IDs op de achtergrond aan

### `lazySyncAnilistEpisodes()`
- Synchroniseert episode-aantallen met AniList

## domein/Components.js

### `buildStatusDropdown(currentStatus, onChange)`
- Bouwt het statusmenu voor films, seizoenen en episodes

### `buildPlayDropdown(item, seasonNumber, episodeNumber)`
- Bouwt het playback-menu en opent de gekozen embedbron

### `buildCard(group, computedStatus)`
- Bouwt een franchisekaart voor grid- en listweergave

### `buildDetailGroup(group)`
- Bouwt de inhoud van de detailmodal

### `buildSeasonRow(item, season)`
- Bouwt een seizoenrij met uitklapbare afleveringen

## domein/Modals.js

### `showRatingModal(item, changeStatus)`
- Opent de scoremodal voor een item

### `showDetailModal(group)`
- Bouwt en opent de detailmodal voor een franchisegroep

### `initEventListeners()`
- Registreert modal-events éénmalig

## domein/BatchActions.js

### `renderBatchBar(x, y)`
- Rendert de zwevende batch-actiebalk

### `clearSelection()`
- Leegt de huidige episode-selectie

### `applyBatchStatus(status)`
- Past een status in bulk toe op alle geselecteerde episodes

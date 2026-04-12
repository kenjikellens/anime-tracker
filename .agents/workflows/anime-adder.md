---
description: # Anime Data Beheer
---

# Anime Data Beheer

Wanneer je een anime serie toevoegt, bijwerkt of verplaatst, volg dan strikt deze structuur:

1. **Bestand: data/data.json**
   - **ID**: Gebruik een lowercase-slug format (bijv: "horimiya" of "rascal-does-not-dream").
   - **Status (Hoofdniveau)**: 
     - Gebruik `1` als ALLE seizoenen/films in de lijst zijn bekeken.
     - Gebruik `2` als er nog items zijn die bekeken moeten worden (te_bekijken).
   - **Items**: Elk seizoen, OVA of film krijgt een eigen object in de `items` array.
     - **Item ID**: `{parent-id}-ep-{volgnummer}` (bijv: "horimiya-ep-0").
     - **Item Status**: `1` voor bekeken, `2` voor nog bekijken.
     - **Type**: Gebruik alleen: "SERIE", "MOVIE", "OVA", "SPECIAL", "ONA", of "SPIN-OFF".
     - **WatchedEpisodes**: Altijd een lege array `[]` bij toevoegen.
   - **Rating**: Gebruik `0` voor nog niet bekeken anime.
   - **Afbeeldingen**: Gebruik bij voorkeur AniList links voor `coverImage` en `bannerImage`, je hebt een api in de code zitten.

2. **Bestand: docs/te_bekijken.md** (Indien nog niet (volledig) bekeken)
   - Voeg de serie toe onder een `## Anime Titel` header.
   - Gebruik checkboxes voor de items: `- [ ] Seizoen Naam (Type - X eps)`.

3. **Bestand: docs/al_bekeken.md** (Indien (deels) bekeken)
   - Voeg de serie toe onder een `## Anime Titel` header.
   - Zelfde format als `te_bekijken.md`. Let op: items die al bekeken zijn in de database mogen hier ook staan ter overzicht.

4. **Consistentie**:
   - Zorg dat de `title` in `data.json` EXACT overeenkomt met de `## Header` in de markdown bestanden.
   - Controleer altijd eerst of een anime al bestaat in `data.json` voordat je een nieuwe toevoegt om duplicaten te voorkomen.
</RULE>
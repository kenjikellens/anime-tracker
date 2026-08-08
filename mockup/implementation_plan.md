# Implementation Plan - Type & Badge Styling Sync

Beschrijving van hoe de stijlvoorbeelden uit `mockup/index.html` (SERIE, FILM, OVA, SPECIAL, ONA, status pills, rating badges) in de echte applicatie geïntegreerd worden.

## Proposed Changes

### 1. `styles.css`
- Borgen dat `.item-type-badge` voor alle varianten (`.type-serie`, `.type-film`, `.type-ova`, `.type-special`, `.type-ona`) een eenduidige kleurencodering heeft die zowel in Licht als Donker thema werkt.
- Zorgen dat de badges netjes uitgelijnd zijn in de `badge-area` van `card.html` en `DetailRenderer.js`.

### 2. `DetailRenderer.js`
- Toepassen van de `.type-${(item.type || 'serie').toLowerCase()}` CSS-klasse op de `item-type-badge` span elementen in `DetailRenderer.js`.

## Verification Plan
- `mockup/index.html` in de browser openen en met de thema-knop wisselen om het kleurcontrast in licht en donker thema te verifiëren.

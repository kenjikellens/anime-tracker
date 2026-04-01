# Anime Tracker | UI Specification

This document defines the expected UI/UX behavior for the Anime Tracker application.

## 1. Title Display Rules
- **Franchise Headers**: Must be clear and unique.
- **Redundancy Exclusion**: If an item title (Movie/Season) overlaps significantly with the franchise name (e.g., "Rascal Does Not Dream of Santa Claus" in the "Rascal Does Not Dream" franchise), the redundant part of the title MUST be hidden.
- **Double Titles**: Under NO circumstances should a title be shown twice for a single item in the same view context.

## 2. Navigation & Toggling
- **Card Click**: Clicking a card opens its details (modal or expansion).
- **Persistent Open**: Clicking a card that is ALREADY open should NOT close it. This prevents accidental UI flickering while reading details.
- **Closing**: Use the dedicated "Close" button (&times;) or click outside the modal/active area to close.

## 3. Multi-Selection (Ctrl + Click)
- **Standard Selection**: A single click on an episode row selects it.
- **Toggle Mode**: Re-clicking a selected episode deselects it.
- **Ctrl + Click**: Allows selecting multiple non-contiguous episodes.
- **Batch Bar**: Appears near the cursor or at the bottom when episodes are selected, offering bulk actions (Bekeken, Bezig, etc.).
- **Clearance**: Selection must NOT be cleared by clicking empty areas inside the modal unless explicitly requested (via "Clear" button).

## 4. Visual Integrity
- **No Translation Animations**: Absolutely ZERO `translate`, `translateX`, or `translateY` CSS properties are allowed for animations.
- **Status Badges**: Must accurately reflect the computed status (-1, 0, 1, 2) and use a consistent color palette.

## 5. Performance
- **Lazy Loading**: Posters and large season data must load in the background to ensure a snappy initial render of the list/grid.

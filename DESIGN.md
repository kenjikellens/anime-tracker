# RASCAL Design System (`DESIGN.md`)

## Architecture & Cascade Layers
RASCAL uses native CSS Cascade Layers declared in `css/styles.css`:

```css
@layer base, theme;
```

- **`@layer base`** (`css/styles.css`): Core layout, typography (`Outfit`), components, responsive breakpoints, accessibility focus rings, and default light/dark tokens.
- **`@layer theme`** (`css/neon.css`, `css/oled-luxury.css`, `css/vertical-nav.css`, `css/cinema-browse.css`): Visual theme overrides and layout variants. Because `@layer theme` has higher cascade priority than `@layer base`, themes override base styles without `!important`.

## Core Token Contract
Every color theme (`[data-theme="light"]` and `[data-theme="dark"]`) must define:

| Token | Purpose | Contrast Requirement |
|---|---|---|
| `--bg`, `--surface`, `--surface-card`, `--surface-2`, `--surface-hover` | Layered neutral surfaces | Distinct step per level |
| `--text`, `--text-muted`, `--white` | Primary and secondary foreground text | `>= 4.5:1` against `--surface` / `--surface-card` |
| `--primary`, `--primary-rgb` | Brand accent + RGB triplet for `rgba(var(--primary-rgb), ...)` | `>= 4.5:1` for text accents |
| `--active-bg`, `--active-color` | Selected filter/view pills and primary actions | `>= 4.5:1` |
| `--status-btn-bg`, `--status-btn-color` | Custom dropdown triggers & play buttons at rest | `>= 4.5:1` |
| `--status-btn-hover`, `--status-btn-hover-color` | Custom dropdown triggers & play buttons on hover/focus | `>= 4.5:1` (never equal) |
| `--segment-track` | Unfilled segment track in rating bars | Visible in both light & dark modes |
| `--focus-ring` | `:focus-visible` outline color | `>= 3:1` against adjacent surfaces |

## Responsive & Accessibility Rules
- **Breakpoints**: Desktop rail layouts (`vertical-nav.css`) must be scoped inside `@media (min-width: 1024px)`. Below `1024px`, `#queue-sidebar` acts as an overlay without shifting `#app` margin.
- **Reduced Motion**: `@media (prefers-reduced-motion: reduce)` disables infinite spinner animations and transitions; JS `scrollTo` checks `prefers-reduced-motion` before smooth scrolling.
- **Touch Targets**: Interactive controls maintain `>= 28px` on desktop and `>= 40px` on `@media (pointer: coarse)`.
- **SVG Reuse**: All icons live in the `#icon-*` sprite in `index.html` and are referenced via `<use href="#icon-...">`.

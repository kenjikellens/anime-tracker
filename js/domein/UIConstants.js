/**
 * UIConstants module.
 * Centralized registry of UI class tokens, dataset attributes, and status mappings.
 * Decouples styling string literals from application logic.
 */
export const UI_CLASSES = {
    ACTIVE: 'active',
    HIDDEN: 'hidden',
    GRID_VIEW: 'grid-view',
    LIST_VIEW: 'list-view',
    ULTIMATE_HOVER: 'ultimate-hover-effect',
    DROPDOWN: {
        WRAPPER: 'custom-select-wrapper',
        TRIGGER: 'custom-select-trigger',
        LABEL: 'custom-select-label',
        CHEVRON: 'custom-select-chevron',
        MENU: 'custom-select-menu',
        OPTION: 'custom-select-option',
        CHECK: 'custom-select-check',
        ITEM_STATUS: 'item-status-select',
        FULL_WIDTH: 'full-width'
    },
    RATING: {
        BADGE: 'rating-badge',
        ACTIONABLE: 'rating-actionable',
        CINEMA: 'r-cinema',
        AWESOME: 'r-awesome',
        GREAT: 'r-great',
        GOOD: 'r-good',
        REGULAR: 'r-regular',
        BAD: 'r-bad',
        GARBAGE: 'r-garbage',
        UNRATED: 'unrated',
        GLOW_GOLD: 'glow-gold'
    }
};

export const DATA_ATTRS = {
    STATUS: 'data-status',
    RATING: 'data-rating',
    ACTIVE: 'data-active',
    ITEM_ID: 'data-item-id',
    EPISODE: 'data-ep',
    THEME: 'data-theme'
};

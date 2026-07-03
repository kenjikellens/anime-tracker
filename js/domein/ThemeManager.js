import { CookieManager } from './CookieManager.js';

const THEME_KEY = 'theme';
const THEMES = {
    LIGHT: 'light',
    DARK: 'dark',
};

const SVG_ICONS = {
    sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 1.2em; height: 1.2em; display: inline-block; vertical-align: middle;"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
    moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 1.2em; height: 1.2em; display: inline-block; vertical-align: middle;"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`
};

/**
 * Helper function to retrieve the SVG markup for the theme icon.
 * @param {string} theme - The theme name ('light' or 'dark').
 * @returns {string} The SVG markup.
 */
function getThemeIcon(theme) {
    return theme === THEMES.DARK ? SVG_ICONS.sun : SVG_ICONS.moon;
}

/**
 * Helper function to retrieve the tooltip title for the theme toggle button.
 * @param {string} theme - The theme name ('light' or 'dark').
 * @returns {string} The tooltip title.
 */
function getThemeTitle(theme) {
    return theme === THEMES.DARK ? 'Switch to light mode' : 'Switch to dark mode';
}

/**
 * Manages the application theme (light or dark mode),
 * persisting the choice in a cookie and applying it to the document element.
 */
export class ThemeManager {
    /**
     * Retrieves the theme saved in the cookies. Falls back to light theme.
     * @returns {string} The saved theme ('light' or 'dark').
     */
    static getSavedTheme() {
        const savedTheme = CookieManager.get(THEME_KEY);
        return savedTheme === THEMES.DARK ? THEMES.DARK : THEMES.LIGHT;
    }

    /**
     * Applies the specified theme to the document element and saves it to a cookie.
     * @param {string} theme - The theme to apply ('light' or 'dark').
     * @returns {string} The normalized theme that was applied.
     */
    static applyTheme(theme) {
        const normalizedTheme = theme === THEMES.DARK ? THEMES.DARK : THEMES.LIGHT;
        document.documentElement.setAttribute('data-theme', normalizedTheme);
        CookieManager.set(THEME_KEY, normalizedTheme);
        return normalizedTheme;
    }

    /**
     * Initializes the theme on application startup using the saved theme.
     * @returns {string} The initialized theme.
     */
    static initTheme() {
        return this.applyTheme(this.getSavedTheme());
    }

    /**
     * Synchronizes the icon and title of the theme toggle button with the current theme.
     * @param {HTMLElement} button - The button element to synchronize.
     * @param {string} theme - The active theme.
     */
    static syncToggleButton(button, theme) {
        if (!button) return;
        button.innerHTML = getThemeIcon(theme);
        button.title = getThemeTitle(theme);
        button.setAttribute('aria-label', getThemeTitle(theme));
    }

    /**
     * Binds the click event to the theme toggle button to switch themes.
     * @param {string} buttonId - The ID of the toggle button element in the DOM.
     */
    static bindToggle(buttonId) {
        const button = document.getElementById(buttonId);
        if (!button) return;

        const currentTheme = this.getSavedTheme();
        this.syncToggleButton(button, currentTheme);

        button.addEventListener('click', () => {
            const activeTheme = document.documentElement.getAttribute('data-theme') === THEMES.DARK
                ? THEMES.DARK
                : THEMES.LIGHT;
            const nextTheme = activeTheme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
            this.applyTheme(nextTheme);
            this.syncToggleButton(button, nextTheme);
        });
    }
}

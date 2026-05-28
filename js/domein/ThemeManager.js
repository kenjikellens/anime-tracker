import { CookieManager } from './CookieManager.js';

const THEME_KEY = 'theme';
const THEMES = {
    LIGHT: 'light',
    DARK: 'dark',
};

/**
 * Helper function to retrieve the FontAwesome class for the theme icon.
 * @param {string} theme - The theme name ('light' or 'dark').
 * @returns {string} The FontAwesome class name.
 */
function getThemeIcon(theme) {
    return theme === THEMES.DARK ? 'fa-sun' : 'fa-moon';
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

        const icon = button.querySelector('i');
        if (icon) {
            icon.className = `fas ${getThemeIcon(theme)}`;
        }
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

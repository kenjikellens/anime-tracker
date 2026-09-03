import { CookieManager } from './CookieManager.js';
import { DropdownManager } from './DropdownManager.js';

const THEME_KEY = 'theme';
const THEME_CSS_KEY = 'theme_css';
const DEFAULT_THEME_CSS = 'styles.css';
const THEMES = {
    LIGHT: 'light',
    DARK: 'dark',
};

/**
 * Helper function to retrieve the tooltip title for the theme toggle button.
 * @param {string} theme - The theme name ('light' or 'dark').
 * @returns {string} The tooltip title.
 */
function getThemeTitle(theme) {
    return theme === THEMES.DARK ? 'Switch to light mode' : 'Switch to dark mode';
}

/**
 * Manages the application theme (light or dark mode) and dynamic CSS stylesheets,
 * persisting the choices in cookies and applying them to the document element.
 */
export class ThemeManager {
    /**
     * Retrieves the theme saved in the cookies. Falls back to light theme.
     * @returns {string} The saved theme ('light' or 'dark').
     */
    static getSavedTheme() {
        const savedTheme = CookieManager.get(THEME_KEY);
        if (savedTheme === THEMES.LIGHT) return THEMES.LIGHT;
        return THEMES.DARK;
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
     * Synchronizes the title of the theme toggle button with the current theme.
     * @param {HTMLElement} button - The button element to synchronize.
     * @param {string} theme - The active theme.
     */
    static syncToggleButton(button, theme) {
        if (!button) return;
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

    /**
     * Retrieves the saved CSS theme file name from cookies, falling back to 'styles.css'.
     * This affects which stylesheet is loaded on startup.
     * @returns {string} The active CSS file name.
     */
    static getSavedThemeFile() {
        return CookieManager.get(THEME_CSS_KEY) || DEFAULT_THEME_CSS;
    }

    /**
     * Applies the specified CSS file as the active theme override and persists the choice in cookies.
     * This modifies the theme override <link> tag in the document head and updates application styling.
     * @param {string} filename - The name of the CSS file to load.
     * @returns {string} The applied filename.
     */
    static applyThemeFile(filename) {
        const normalizedFile = filename && filename.trim() !== '' ? filename.trim() : DEFAULT_THEME_CSS;
        let linkEl = document.getElementById('theme-override-stylesheet');
        if (!linkEl) {
            linkEl = document.createElement('link');
            linkEl.id = 'theme-override-stylesheet';
            linkEl.rel = 'stylesheet';
            document.head.appendChild(linkEl);
        }

        if (normalizedFile === DEFAULT_THEME_CSS) {
            linkEl.removeAttribute('href');
        } else {
            linkEl.setAttribute('href', `css/${encodeURIComponent(normalizedFile)}`);
        }

        CookieManager.set(THEME_CSS_KEY, normalizedFile);
        return normalizedFile;
    }

    /**
     * Fetches the list of available CSS theme files from the backend API.
     * This queries the server dynamically to discover all stylesheets in the css directory.
     * @returns {Promise<string[]>} Array of available CSS file names.
     */
    static async fetchAvailableThemes() {
        try {
            const response = await fetch('/api/themes');
            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data.themes) && data.themes.length > 0) {
                    return data.themes;
                }
            }
        } catch (err) {
            console.warn('Could not fetch themes from API, falling back to default:', err);
        }
        return [DEFAULT_THEME_CSS];
    }

    /**
     * Formats a CSS filename dynamically into a human-readable display label for the UI selector.
     * Capitalizes words, handles dashes and underscores, and shows the filename dynamically without hardcoded mappings.
     * @param {string} filename - The CSS file name.
     * @returns {string} The formatted display label.
     */
    static formatThemeName(filename) {
        if (filename === DEFAULT_THEME_CSS) return 'Standaard (styles.css)';
        const cleanBase = filename.replace(/\.css$/i, '').replace(/[-_]+/g, ' ').trim();
        const words = cleanBase.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
        const formattedTitle = words.join(' ');
        return `${formattedTitle} (${filename})`;
    }

    /**
     * Initializes the theme picker icon button and floating popup menu.
     * This handles opening the theme menu, rendering theme options with checkmarks, and applying themes.
     * @param {string} [buttonId='theme-picker-btn'] - ID of the theme picker icon button.
     * @param {string} [menuId='theme-picker-menu'] - ID of the theme picker floating menu container.
     */
    static async initThemePicker(buttonId = 'theme-picker-btn', menuId = 'theme-picker-menu') {
        const btn = document.getElementById(buttonId);
        const menu = document.getElementById(menuId);
        if (!btn || !menu) return;

        let themes = await this.fetchAvailableThemes();
        let currentSavedFile = this.getSavedThemeFile();
        this.applyThemeFile(currentSavedFile);

        const renderMenu = () => {
            menu.innerHTML = '';
            menu.style.width = 'max-content';
            menu.style.minWidth = 'max-content';
            themes.forEach(themeFile => {
                const isSelected = themeFile === currentSavedFile;
                const item = document.createElement('div');
                item.className = `custom-select-option ${isSelected ? 'active' : ''}`;
                item.style.whiteSpace = 'nowrap';
                item.style.display = 'flex';
                item.style.alignItems = 'center';
                item.style.justifyContent = 'space-between';
                item.style.gap = '24px';
                item.style.width = 'auto';
                if (isSelected) item.dataset.active = 'true';
                item.dataset.value = themeFile;

                const textSpan = document.createElement('span');
                textSpan.textContent = this.formatThemeName(themeFile);
                textSpan.style.whiteSpace = 'nowrap';
                textSpan.style.flexShrink = '0';
                item.appendChild(textSpan);

                if (isSelected) {
                    const checkSvg = `
                        <svg class="custom-select-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0; margin-left: auto;">
                            <use href="#icon-check"></use>
                        </svg>
                    `;
                    item.insertAdjacentHTML('beforeend', checkSvg);
                }

                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    currentSavedFile = themeFile;
                    this.applyThemeFile(themeFile);
                    closeMenu();
                    renderMenu();
                });

                menu.appendChild(item);
            });
        };

        const toggleMenu = (e) => {
            e.stopPropagation();
            const isOpen = menu.classList.contains('open');
            if (isOpen) {
                closeMenu();
            } else {
                openMenu();
            }
        };

        const openMenu = async () => {
            themes = await this.fetchAvailableThemes();
            renderMenu();
            menu.classList.add('open');
        };

        const closeMenu = () => {
            menu.classList.remove('open');
        };

        btn.addEventListener('click', toggleMenu);
        menu.addEventListener('click', (e) => e.stopPropagation());
        document.addEventListener('click', closeMenu);
    }
}


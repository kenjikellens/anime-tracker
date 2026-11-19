import { CookieManager } from './CookieManager.js';

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
    return theme === THEMES.DARK ? 'Schakel naar licht thema' : 'Schakel naar donker thema';
}

/**
 * Manages the application theme (light or dark mode) and dynamic CSS stylesheets,
 * persisting the choices in cookies and applying them to the document element.
 */
export class ThemeManager {
    /**
     * Retrieves the theme saved in the cookies. Falls back to dark theme.
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
     * @returns {string} The active CSS file name.
     */
    static getSavedThemeFile() {
        return CookieManager.get(THEME_CSS_KEY) || DEFAULT_THEME_CSS;
    }

    /**
     * Applies the specified CSS file as the active theme override and persists the choice in cookies.
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

        const closeMenu = (restoreFocus = false) => {
            menu.classList.remove('open');
            btn.setAttribute('aria-expanded', 'false');
            if (restoreFocus) btn.focus();
        };

        const renderMenu = () => {
            menu.innerHTML = '';
            themes.forEach(themeFile => {
                const isSelected = themeFile === currentSavedFile;
                const item = document.createElement('button');
                item.type = 'button';
                item.className = `custom-select-option ${isSelected ? 'active' : ''}`;
                item.setAttribute('role', 'menuitemradio');
                item.setAttribute('aria-checked', isSelected ? 'true' : 'false');
                if (isSelected) item.dataset.active = 'true';
                item.dataset.value = themeFile;

                const textSpan = document.createElement('span');
                textSpan.textContent = this.formatThemeName(themeFile);
                item.appendChild(textSpan);

                if (isSelected) {
                    const checkSvg = `
                        <svg class="custom-select-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <use href="#icon-check"></use>
                        </svg>
                    `;
                    item.insertAdjacentHTML('beforeend', checkSvg);
                }

                const selectTheme = () => {
                    currentSavedFile = themeFile;
                    this.applyThemeFile(themeFile);
                    closeMenu(true);
                    renderMenu();
                };

                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    selectTheme();
                });

                item.addEventListener('keydown', (e) => {
                    const items = Array.from(menu.querySelectorAll('[role="menuitemradio"]'));
                    const idx = items.indexOf(item);
                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        items[(idx + 1) % items.length]?.focus();
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        items[(idx - 1 + items.length) % items.length]?.focus();
                    } else if (e.key === 'Home') {
                        e.preventDefault();
                        items[0]?.focus();
                    } else if (e.key === 'End') {
                        e.preventDefault();
                        items[items.length - 1]?.focus();
                    } else if (e.key === 'Escape') {
                        e.preventDefault();
                        closeMenu(true);
                    }
                });

                menu.appendChild(item);
            });
        };

        const openMenu = async (focusFirst = false) => {
            themes = await this.fetchAvailableThemes();
            renderMenu();
            menu.classList.add('open');
            btn.setAttribute('aria-expanded', 'true');
            if (focusFirst) {
                const activeItem = menu.querySelector('[aria-checked="true"]') || menu.querySelector('[role="menuitemradio"]');
                if (activeItem) activeItem.focus();
            }
        };

        const toggleMenu = (e) => {
            e.stopPropagation();
            if (menu.classList.contains('open')) {
                closeMenu(false);
            } else {
                openMenu(false);
            }
        };

        btn.addEventListener('click', toggleMenu);
        btn.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                openMenu(true);
            } else if (e.key === 'Escape') {
                closeMenu(true);
            }
        });

        menu.addEventListener('click', (e) => e.stopPropagation());
        document.addEventListener('click', () => closeMenu(false));
    }
}

const THEME_KEY = 'theme';
const THEMES = {
    LIGHT: 'light',
    DARK: 'dark',
};

function getThemeIcon(theme) {
    return theme === THEMES.DARK ? 'fa-sun' : 'fa-moon';
}

function getThemeTitle(theme) {
    return theme === THEMES.DARK ? 'Switch to light mode' : 'Switch to dark mode';
}

export class ThemeManager {
    static getSavedTheme() {
        const savedTheme = localStorage.getItem(THEME_KEY);
        return savedTheme === THEMES.DARK ? THEMES.DARK : THEMES.LIGHT;
    }

    static applyTheme(theme) {
        const normalizedTheme = theme === THEMES.DARK ? THEMES.DARK : THEMES.LIGHT;
        document.documentElement.setAttribute('data-theme', normalizedTheme);
        localStorage.setItem(THEME_KEY, normalizedTheme);
        return normalizedTheme;
    }

    static initTheme() {
        return this.applyTheme(this.getSavedTheme());
    }

    static syncToggleButton(button, theme) {
        if (!button) return;

        const icon = button.querySelector('i');
        if (icon) {
            icon.className = `fas ${getThemeIcon(theme)}`;
        }
        button.title = getThemeTitle(theme);
        button.setAttribute('aria-label', getThemeTitle(theme));
    }

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

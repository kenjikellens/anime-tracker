/**
 * Helper class to manage cookies in the browser.
 * Provides static methods to get, set, and delete cookies.
 */
export class CookieManager {
    /**
     * Retrieves the value of a cookie by name.
     * @param {string} name - The name of the cookie to retrieve.
     * @returns {string|null} The value of the cookie, or null if not found.
     */
    static get(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) {
            return decodeURIComponent(parts.pop().split(';').shift());
        }
        return null;
    }

    /**
     * Sets a cookie with a specific name, value, and expiration in days.
     * @param {string} name - The name of the cookie.
     * @param {string} value - The value to store.
     * @param {number} [days=365] - Number of days until expiration.
     */
    static set(name, value, days = 365) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        const expires = `; expires=${date.toUTCString()}`;
        document.cookie = `${name}=${encodeURIComponent(value)}${expires}; path=/; SameSite=Lax`;
    }

    /**
     * Deletes a cookie by setting its expiration date in the past.
     * @param {string} name - The name of the cookie to delete.
     */
    static delete(name) {
        document.cookie = `${name}=; Max-Age=-99999999; path=/; SameSite=Lax`;
    }
}

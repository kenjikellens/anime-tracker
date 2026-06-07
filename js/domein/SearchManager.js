/**
 * Binds a text input to a search callback.
 * Linked to: the overview search bar.
 */
export class SearchManager {
    /**
     * Binds an input element to a search callback with a debounce delay.
     * This delays executing the search callback to prevent lag during rapid typing.
     * @param {string} inputId - The ID of the input element.
     * @param {Function} onSearch - The callback function when the search changes.
     * @param {number} [delay=150] - The debounce delay in milliseconds.
     */
    static setup(inputId, onSearch, delay = 150) {
        const input = document.getElementById(inputId);
        if (!input) return;

        let timeoutId;
        input.addEventListener('input', (e) => {
            const query = e.target.value;
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                if (onSearch) onSearch(query);
            }, delay);
        });
    }
}

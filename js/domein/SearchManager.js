/**
 * Binds a text input to a search callback.
 * Linked to: the overview search bar.
 */
export class SearchManager {
    /**
     * Registers an input listener and forwards the query string.
     */
    static setup(inputId, onSearch) {
        const input = document.getElementById(inputId);
        if (!input) return;

        input.addEventListener('input', (e) => {
            const query = e.target.value;
            if (onSearch) onSearch(query);
        });
    }
}

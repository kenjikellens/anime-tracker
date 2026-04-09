export class SearchManager {
    static setup(inputId, onSearch) {
        const input = document.getElementById(inputId);
        if (!input) return;

        input.addEventListener('input', (e) => {
            const query = e.target.value;
            if (onSearch) onSearch(query);
        });
    }
}

let saveTimeoutId = null;

/**
 * Storage helper for loading, saving, and exporting anime data.
 * Linked to: `data/data.json`, `localStorage`, and Flask `/api/save`.
 */
export class DataStore {
    /**
     * Loads file data first, then falls back to localStorage.
     * @returns {Promise<Array>} Loaded anime data array.
     */
    static async loadInitialData() {
        try {
            const res = await fetch('data/data.json?v=' + Date.now());
            const fileData = await res.json();
            return fileData;
        } catch (e) {
            console.warn("Could not load data.json, checking localStorage", e);
            const localData = localStorage.getItem('rascal_anime_data');
            if (localData) {
                try {
                    return JSON.parse(localData);
                } catch (e2) {
                    console.error("Local data parsing also failed", e2);
                }
            }
            return [];
        }
    }

    /**
     * Persists the repository to localStorage immediately and debounces network saves.
     * @param {Object} repository - The anime repository instance to save.
     */
    static async save(repository) {
        const data = repository.exportToData();

        // Immediate local storage update
        localStorage.setItem('rascal_anime_data', JSON.stringify(data));

        // Debounce server API save request to batch rapid updates
        clearTimeout(saveTimeoutId);
        return new Promise((resolve) => {
            saveTimeoutId = setTimeout(async () => {
                try {
                    await fetch('/api/save', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    });
                } catch (err) {
                    // Server not running, ignore.
                }
                resolve();
            }, 150);
        });
    }

    /**
     * Downloads the current state as a JSON file backup.
     * @param {Object} repository - The repository model instance.
     */
    static triggerBackup(repository) {
        const data = repository.exportToData();
        const str = JSON.stringify(data, null, 4);
        const blob = new Blob([str], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "data.json";
        a.click();
        URL.revokeObjectURL(url);
    }
}

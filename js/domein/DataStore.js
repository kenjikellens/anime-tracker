/**
 * Storage helper for loading, saving, and exporting anime data.
 * Linked to: `data/data.json`, `localStorage`, and Flask `/api/save`.
 */
export class DataStore {
    /**
     * Loads file data first, then falls back to localStorage.
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
     * Persists the repository to localStorage and to the running server.
     */
    static async save(repository) {
        const data = repository.exportToData();

        localStorage.setItem('rascal_anime_data', JSON.stringify(data));

        try {
            await fetch('/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } catch (err) {
            // Server not running, ignore.
        }
    }

    /**
     * Downloads the current state as a JSON file.
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

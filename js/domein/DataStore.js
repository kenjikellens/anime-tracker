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
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const fileData = await res.json();
            return Array.isArray(fileData) ? fileData : [];
        } catch (e) {
            console.warn("Could not load data.json, checking localStorage", e);
            const localData = localStorage.getItem('rascal_anime_data');
            if (localData) {
                try {
                    const parsed = JSON.parse(localData);
                    return Array.isArray(parsed) ? parsed : [];
                } catch (e2) {
                    console.error("Local data parsing also failed", e2);
                }
            }
            return [];
        }
    }

    /**
     * Persists the repository to localStorage immediately and posts to Flask `/api/save`.
     * @param {Object} repository - The anime repository instance to save.
     * @returns {Promise<boolean>} True if backend persistence succeeded, false if local-only.
     */
    static async save(repository) {
        const data = repository.exportToData();

        // Immediate local storage update
        localStorage.setItem('rascal_anime_data', JSON.stringify(data));

        try {
            const res = await fetch('/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) {
                console.warn(`Backend save failed with HTTP ${res.status}; kept in localStorage.`);
                return false;
            }
            return true;
        } catch (err) {
            console.warn('Backend offline during save; persisted to localStorage only.', err);
            return false;
        }
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
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
}

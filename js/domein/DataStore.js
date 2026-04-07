export class DataStore {
    static async loadInitialData() {
        // ALWAYS prioritize the JSON file to ensure users see their file-level changes
        try {
            const res = await fetch('data/data.json?v=' + Date.now()); 
            const fileData = await res.json();
            return fileData;
        } catch(e) {
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

    static async save(repository) {
        const data = repository.exportToData();
        
        // 1. Session persistence
        localStorage.setItem('rascal_anime_data', JSON.stringify(data));
        
        // 2. Persistent file storage if server is running
        try {
            await fetch('/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } catch (err) {
            // Server not running, ignore
        }
    }
    
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
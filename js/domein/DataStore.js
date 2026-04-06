export class DataStore {
    static async loadInitialData() {
        const localData = localStorage.getItem('rascal_anime_data');
        if (localData) {
            try {
                return JSON.parse(localData);
            } catch (e) {
                console.error("Local data parsing failed", e);
            }
        }
        try {
            const res = await fetch('data/data.json');
            return await res.json();
        } catch(e) {
            console.error("Failed to fetch data.json", e);
            return [];
        }
    }

    static save(repository) {
        const data = repository.exportToData();
        localStorage.setItem('rascal_anime_data', JSON.stringify(data));
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
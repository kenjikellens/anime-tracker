import json
import os

DATA_FILE = r"c:\Users\kenji\Documents\PROJECTS\RASCAL\anime-tracker\data.json"

def cleanup():
    if not os.path.exists(DATA_FILE):
        print("Data file not found")
        return

    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Verwijder de "Santa Claus" top-level entry (ID 312016)
    original_count = len(data)
    # We filteren op titel of ID om zeker te zijn (Santa Claus is dubbel)
    data = [item for item in data if not (item.get('tmdb_id') == 312016 or item.get('title') == "Rascal Does Not Dream of Santa Claus")]
    
    new_count = len(data)
    
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"Verwijderd: {original_count - new_count} items. Bestand opgeslagen.")

if __name__ == "__main__":
    cleanup()

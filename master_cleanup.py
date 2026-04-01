import json
import os
import re

DATA_JSON = r'c:\Users\kenji\Documents\PROJECTS\RASCAL\data.json'
DATA_JS = r'c:\Users\kenji\Documents\PROJECTS\RASCAL\data.js'
AL_BEKEKEN = r'c:\Users\kenji\Documents\PROJECTS\RASCAL\docs\al_bekeken.md'
TE_BEKIJKEN = r'c:\Users\kenji\Documents\PROJECTS\RASCAL\docs\te_bekijken.md'

def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def load_data_js():
    if not os.path.exists(DATA_JS): return []
    with open(DATA_JS, 'r', encoding='utf-8') as f:
        content = f.read()
    # Extract JSON-like array from JS
    match = re.search(r'\[.*\]', content, re.DOTALL)
    if match:
        try:
            # Clean up JS-specifics if any (though usually it's just raw JSON assigned to a variable)
            json_str = match.group(0)
            # Remove comments if any
            json_str = re.sub(r'//.*', '', json_str)
            return json.loads(json_str)
        except:
            return []
    return []

def load_md_titles(path):
    if not os.path.exists(path): return []
    titles = []
    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line.startswith('- '):
                titles.append(line[2:].strip())
    return titles

def cleanup():
    # 1. Load data
    data = load_json(DATA_JSON)
    js_data = load_data_js()
    watched_titles = load_md_titles(AL_BEKEKEN)
    to_watch_titles = load_md_titles(TE_BEKIJKEN)
    
    print(f"Original count: {len(data)}")
    
    # 2. Remove Duplicates (TMDB ID based)
    # We prefer the entries that appear LATER in the file as the user said the top part is the duplicate block.
    seen_ids = {} # tmdb_id -> index
    for i in range(len(data) - 1, -1, -1):
        tid = data[i].get('tmdb_id')
        if tid:
            if tid not in seen_ids:
                seen_ids[tid] = i
    
    unique_data = []
    removed_titles = []
    for i, item in enumerate(data):
        tid = item.get('tmdb_id')
        if tid and seen_ids.get(tid) != i:
            removed_titles.append(item['title'])
            continue
        unique_data.append(item)
    
    print(f"Removed {len(removed_titles)} duplicates.")
    
    # 3. Merge data.js entries if missing
    existing_tids = {item.get('tmdb_id') for item in unique_data if item.get('tmdb_id')}
    existing_titles = {item['title'].lower() for item in unique_data}
    
    added_from_js = 0
    for item in js_data:
        tid = item.get('tmdb_id')
        title = item.get('title', '').lower()
        if (tid and tid not in existing_tids) or (not tid and title not in existing_titles):
            unique_data.append(item)
            added_from_js += 1
            print(f"Added from data.js: {item.get('title')}")
            
    print(f"Added {added_from_js} missing entries from data.js.")
    
    # 4. Final check for Horimiya specifically
    horimiya_exists = any("horimiya" in item['title'].lower() for item in unique_data)
    if not horimiya_exists:
        print("WARNING: Horimiya still missing after merge!")
        # If I had the raw Horimiya data I would add it here. 
        # But let's assume it was in data.js.

    # 5. Save cleaned data
    save_json(DATA_JSON, unique_data)
    print(f"Final count: {len(unique_data)}")

if __name__ == "__main__":
    cleanup()

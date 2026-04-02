"""
RASCAL Master Database Cleanup
This utility script performs automated maintenance on the data.json database.
It removes duplicate entries (based on TMDB ID), merges missing entries from 
legacy data.js files, and validates critical entries like 'Horimiya'.
"""

import json
import os
import re

# File Paths Configuration
DATA_JSON = r'c:\Users\kenji\Documents\PROJECTS\RASCAL\data.json'
DATA_JS = r'c:\Users\kenji\Documents\PROJECTS\RASCAL\data.js'
AL_BEKEKEN = r'c:\Users\kenji\Documents\PROJECTS\RASCAL\docs\al_bekeken.md'
TE_BEKIJKEN = r'c:\Users\kenji\Documents\PROJECTS\RASCAL\docs\te_bekijken.md'

def load_json(path):
    """ Loads and parses a JSON file. """
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(path, data):
    """ Saves data to a JSON file with pretty formatting. """
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def load_data_js():
    """ 
    Attempts to parse title objects from a JavaScript file. 
    Uses regex to extract the array portion and basic cleanup to make it JSON-compatible.
    """
    if not os.path.exists(DATA_JS): return []
    with open(DATA_JS, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Extract JSON-like array structure from JS assignment
    match = re.search(r'\[.*\]', content, re.DOTALL)
    if match:
        try:
            json_str = match.group(0)
            # Remove inline comments to avoid JSON parsing errors
            json_str = re.sub(r'//.*', '', json_str)
            return json.loads(json_str)
        except Exception:
            return []
    return []

def load_md_titles(path):
    """ Extracts hyphenated list titles from a Markdown file. """
    if not os.path.exists(path): return []
    titles = []
    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line.startswith('- '):
                titles.append(line[2:].strip())
    return titles

def cleanup():
    """
    Main cleanup routine:
    1. Loads all data sources (JSON, JS, and MD checklists).
    2. De-duplicates data.json entries prioritizing later occurrences.
    3. Merges missing unique entries found in data.js.
    4. Performs targeted validation (e.g. searching for 'Horimiya').
    5. Saves the resulting cleaned list back to data.json.
    """
    # 1. Load data
    data = load_json(DATA_JSON)
    js_data = load_data_js()
    
    print(f"Original count: {len(data)}")
    
    # 2. Remove Duplicates (TMDB ID based)
    # Strategy: Scan from end to beginning to preserve the most recent entries.
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
    
    # 3. Merge data.js entries if missing from the primary database
    existing_tids = {item.get('tmdb_id') for item in unique_data if item.get('tmdb_id')}
    existing_titles = {item['title'].lower() for item in unique_data}
    
    added_from_js = 0
    for item in js_data:
        tid = item.get('tmdb_id')
        title = item.get('title', '').lower()
        # Add if TMDB ID is unique OR if title is unique (for items without IDs)
        if (tid and tid not in existing_tids) or (not tid and title not in existing_titles):
            unique_data.append(item)
            added_from_js += 1
            print(f"Added from data.js: {item.get('title')}")
            
    print(f"Added {added_from_js} missing entries from data.js.")
    
    # 4. Final verification for critical entries
    horimiya_exists = any("horimiya" in item['title'].lower() for item in unique_data)
    if not horimiya_exists:
        print("WARNING: Horimiya still missing after merge!")

    # 5. Commit cleaned data to disk
    save_json(DATA_JSON, unique_data)
    print(f"Final count: {len(unique_data)}")

if __name__ == "__main__":
    cleanup()

import json
import os
import time
import requests

# TMDB Key from app.js
TMDB_API_KEY = 'a341dc9a3c2dffa62668b614a98c1188'
JIKAN_BASE_URL = 'https://api.jikan.moe/v4'
DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(DIR, "data.json")

def load_data():
    if not os.path.exists(DATA_FILE):
        return []
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def save_data(data):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def search_mal(title):
    try:
        print(f"  Searching MAL for '{title}'...")
        res = requests.get(f"{JIKAN_BASE_URL}/anime", params={"q": title, "limit": 1})
        res.raise_for_status()
        data = res.json()
        if data['data']:
            return data['data'][0]['mal_id']
        return None
    except Exception as e:
        print(f"  MAL search error: {e}")
        return None

def get_mal_relations(mal_id):
    try:
        print(f"  Fetching relations for MAL ID {mal_id}...")
        res = requests.get(f"{JIKAN_BASE_URL}/anime/{mal_id}/relations")
        res.raise_for_status()
        data = res.json()
        relations = []
        for entry in data['data']:
            rel_type = entry['relation']
            for item in entry['entry']:
                if item['type'] == 'anime':
                    relations.append({
                        "id": item['mal_id'],
                        "title": item['name'],
                        "relation": rel_type
                    })
        return relations
    except Exception as e:
        print(f"  MAL relations error: {e}")
        return []

def get_tmdb_info(title):
    try:
        res = requests.get(
            f"https://api.themoviedb.org/3/search/multi",
            params={
                "api_key": TMDB_API_KEY,
                "query": title,
                "language": "en-US"
            }
        )
        res.raise_for_status()
        data = res.json()
        if data['results']:
            # Prefer TV/Movie over Person
            results = [r for r in data['results'] if r['media_type'] in ['tv', 'movie']]
            if results:
                best = results[0]
                return {
                    "tmdb_id": best['id'],
                    "type": best['media_type'],
                    "poster_path": best.get('poster_path'),
                    "release_date": best.get('release_date') or best.get('first_air_date')
                }
        return None
    except Exception as e:
        print(f"  TMDB search error for '{title}': {e}")
        return None

def sync_franchise(franchise_name, existing_data, existing_titles):
    print(f"\nProcessing Franchise: {franchise_name}")
    
    # Check if this franchise is already "Bekeken" (status 1)
    # We check if ANY item in this franchise is status 1 or if we should inherit
    franchise_items = [item for item in existing_data if item.get('franchise') == franchise_name]
    
    # Simple logic: if the user has watched at least one thing in this franchise, 
    # we'll assume they've watched the OVAs/Movies they mentioned.
    # Otherwise, it stays -1 (Te Bekijken).
    all_watched = any(item.get('status') == 1 or 
                     (item.get('seasons') and all(all(ep.get('status') == 1 for ep in s['episodes']) for s in item['seasons']))
                     for item in franchise_items)
    
    default_status = 1 if all_watched else -1
    if default_status == 1:
        print(f"  Franchise detected as 'Bekeken'. New items will be marked as watched.")

    mal_id = search_mal(franchise_name)
    if not mal_id:
        return []

    relations = get_mal_relations(mal_id)
    new_items = []

    for rel in relations:
        rel_title = rel['title']
        clean_title = rel_title.lower().strip()
        
        # Check if already exists in data.json
        if any(t.lower().strip() == clean_title for t in existing_titles):
            continue
        
        # Filter for relevant types (Spin-Off, Movie, OVA, Special, Side Story, Prequel, Sequel)
        # Skip "Other" or "Music" unless specifically requested
        if rel['relation'] in ['Other', 'Music']:
            print(f"  Skipping minor relation: {rel_title} ({rel['relation']})")
            continue

        print(f"  Found potential new item: {rel_title} ({rel['relation']})")
        
        # Throttling to respect Jikan API limits (3 requests per second)
        time.sleep(1)
        
        tmdb = get_tmdb_info(rel_title)
        if tmdb:
            new_item = {
                "title": rel_title,
                "rating": -1,
                "status": default_status, # Inherited status
                "tmdb_id": tmdb['tmdb_id'],
                "type": tmdb['type'],
                "poster_path": tmdb['poster_path'],
                "franchise": franchise_name,
                "release_date": tmdb['release_date']
            }
            new_items.append(new_item)
            existing_titles.add(rel_title) 
            print(f"    Added: {rel_title} (TMDB ID: {tmdb['tmdb_id']}, Status: {default_status})")
        else:
            print(f"    Skipped: Could not find on TMDB.")

    return new_items

def main():
    data = load_data()
    existing_titles = {item['title'] for item in data}
    # Track franchises and their common names
    franchises = {item.get('franchise') for item in data if item.get('franchise')}
    
    total_added = 0
    all_new_items = []

    franchises = [f for f in franchises if f]

    for f_name in franchises:
        new_items = sync_franchise(f_name, data, existing_titles)
        if new_items:
            all_new_items.extend(new_items)
            total_added += len(new_items)
        
        time.sleep(1)

    if all_new_items:
        print(f"\nSync complete. Added {total_added} new items.")
        data.extend(all_new_items)
        save_data(data)
    else:
        print("\nNo new items found.")

if __name__ == "__main__":
    main()

"""
RASCAL Data Auditor
This script performs a quality check on the database files (data.json, data.js) 
and cross-references them with the 'te_bekijken.md' checklist to identify 
duplicates, missing entries, or incomplete data structures.
"""

import json
import os
import re

# Absolute paths to critical data files
DATA_JSON = r'c:\Users\kenji\Documents\PROJECTS\RASCAL\data.json'
DATA_JS = r'c:\Users\kenji\Documents\PROJECTS\RASCAL\data.js'
TE_BEKIJKEN_MD = r'c:\Users\kenji\Documents\PROJECTS\RASCAL\docs\te_bekijken.md'

def audit():
    """
    Executes a series of checks to ensure data consistency across multiple sources.
    1. Checks for duplicate titles in data.json.
    2. Identifies TV shows with no seasons or episodes.
    3. Cross-references entries in data.js to ensure they exist in data.json.
    4. Compares the Markdown checklist (te_bekijken.md) against the primary JSON database.
    """
    print("--- Starting Data Audit ---")
    
    # 1. Load data.json
    try:
        with open(DATA_JSON, 'r', encoding='utf-8') as f:
            data_json = json.load(f)
    except Exception as e:
        print(f"Error loading data.json: {e}")
        return

    titles_json = [item['title'] for item in data_json]
    unique_titles = set(titles_json)
    
    if len(titles_json) != len(unique_titles):
        print(f"DUPLICATES FOUND: {len(titles_json) - len(unique_titles)} duplicate entries.")
        # Find which ones
        seen = set()
        dups = []
        for t in titles_json:
            if t in seen:
                dups.append(t)
            seen.add(t)
        print(f"Duplicate samples: {dups[:5]}")
    else:
        print("No duplicate titles in data.json.")

    # 2. Check for empty seasons/episodes
    empty_series = [item['title'] for item in data_json if not item.get('seasons')]
    if empty_series:
        print(f"EMPTY SERIES (No seasons): {len(empty_series)} items found.")
        print(f"Samples: {empty_series[:5]}")

    # 3. Load data.js
    try:
        with open(DATA_JS, 'r', encoding='utf-8') as f:
            content = f.read()
            # Crude regex to extract titles
            titles_js = re.findall(r'title:\s*["\'](.*?)["\']', content)
    except Exception as e:
        print(f"Error reading data.js: {e}")
        titles_js = []

    missing_from_json = [t for t in titles_js if t not in unique_titles]
    if missing_from_json:
        print(f"MISSING FROM JSON (found in data.js): {len(missing_from_json)} items.")
        print(f"Samples: {missing_from_json[:5]}")

    # 4. Load te_bekijken.md
    try:
        with open(TE_BEKIJKEN_MD, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            titles_md = [re.sub(r'^-\s*', '', line.strip()) for line in lines if line.strip().startswith('- ')]
    except Exception as e:
        print(f"Error reading te_bekijken.md: {e}")
        titles_md = []

    missing_md_from_json = [t for t in titles_md if t not in unique_titles]
    if missing_md_from_json:
        print(f"MISSING FROM JSON (found in te_bekijken.md): {len(missing_md_from_json)} items.")
        print(f"Samples: {missing_md_from_json[:5]}")

    print("--- Audit Complete ---")

if __name__ == "__main__":
    audit()

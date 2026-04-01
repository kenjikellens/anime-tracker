import json
import os
import re

def parse_md(file_path):
    titles = []
    if os.path.exists(file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line.startswith('- '):
                    title = line[2:].strip()
                    # Clean up common artifacts if any
                    titles.append(title)
    return titles

def run_comparison():
    base_path = r'c:\Users\kenji\Documents\PROJECTS\RASCAL'
    al_bekeken_path = os.path.join(base_path, 'docs', 'al_bekeken.md')
    te_bekijken_path = os.path.join(base_path, 'docs', 'te_bekijken.md')
    data_json_path = os.path.join(base_path, 'anime-tracker', 'data.json')

    al_bekeken = parse_md(al_bekeken_path)
    te_bekijken = parse_md(te_bekijken_path)
    allowed_titles = set(al_bekeken + te_bekijken)

    with open(data_json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    data_titles = [item['title'] for item in data]
    data_titles_set = set(data_titles)

    extra_in_data = data_titles_set - allowed_titles
    missing_in_data = allowed_titles - data_titles_set

    print(f"Total in MD files: {len(allowed_titles)}")
    print(f"Total in data.json: {len(data_titles)}")
    
    print("\n--- EXTRA SERIES IN DATA.JSON (should probably be removed) ---")
    for t in sorted(list(extra_in_data)):
        print(f"- {t}")

    print("\n--- MISSING SERIES IN DATA.JSON (should probably be added) ---")
    for t in sorted(list(missing_in_data)):
        print(f"- {t}")

if __name__ == "__main__":
    run_comparison()

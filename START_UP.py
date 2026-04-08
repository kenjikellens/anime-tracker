from flask import Flask, request, jsonify, send_from_directory
import os
import json

app = Flask(__name__, static_folder='.')

DATA_FILE = os.path.join('data', 'data.json')

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

@app.route('/api/save', methods=['POST'])
def save_data():
    try:
        new_data = request.get_json()
        if not new_data:
            return jsonify({"error": "No data provided"}), 400
        
        # Ensure the directories exist
        os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
        
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(new_data, f, indent=4, ensure_ascii=False)
            
        print(f"Data saved successfully to {DATA_FILE}")
        return jsonify({"message": "Data saved successfully"}), 200
    except Exception as e:
        print(f"Error saving data: {str(e)}")
        return jsonify({"error": str(e)}), 500

import webbrowser
from threading import Timer

def open_browser():
    webbrowser.open_new("http://localhost:5000")

if __name__ == '__main__':
    print("---------------------------------------------")
    print("Anime Tracker Server is running!")
    print("URL: http://localhost:5000")
    print("---------------------------------------------")
    Timer(1, open_browser).start()
    app.run(port=5000, debug=True, use_reloader=False)

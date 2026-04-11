from flask import Flask, request, jsonify, send_from_directory
import json
import os
import webbrowser
from threading import Timer

# Small Flask host used by the app for static files and JSON persistence.
# Linked to: `DataStore.save()` and the frontend entrypoints.
app = Flask(__name__, static_folder='.')
DATA_FILE = os.path.join('data', 'data.json')


@app.route('/')
def index():
    """Serve the overview page."""
    return send_from_directory('.', 'index.html')


@app.route('/<path:path>')
def serve_static(path):
    """Serve CSS, JS, HTML, and other static files from the project root."""
    return send_from_directory('.', path)


@app.route('/api/save', methods=['POST'])
def save_data():
    """Persist the current anime dataset back into `data/data.json`."""
    try:
        new_data = request.get_json()
        if not new_data:
            return jsonify({"error": "No data provided"}), 400

        os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)

        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(new_data, f, indent=4, ensure_ascii=False)

        print(f"Data saved successfully to {DATA_FILE}")
        return jsonify({"message": "Data saved successfully"}), 200
    except Exception as e:
        print(f"Error saving data: {str(e)}")
        return jsonify({"error": str(e)}), 500


def open_browser():
    """Open the app in the default browser after the server starts."""
    webbrowser.open_new("http://localhost:5000")


if __name__ == '__main__':
    print("---------------------------------------------")
    print("Anime Tracker Server is running!")
    print("URL: http://localhost:5000")
    print("---------------------------------------------")
    Timer(1, open_browser).start()
    app.run(port=5000, debug=True, use_reloader=False)

from flask import Flask, request, jsonify, send_from_directory
import json
import os
import socket
import webbrowser
from threading import Timer

# Small Flask host used by the app for static files and JSON persistence.
# Linked to: `DataStore.save()` and the frontend entrypoints.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app = Flask(__name__, static_folder=None)
DATA_FILE = os.path.join(BASE_DIR, 'data', 'data.json')


# Serves the main HTML entrypoint of the application (index.html).
# This affects the root URL path and loads the client-side interface.
@app.route('/')
def index():
    """Serve the overview page from the base directory."""
    return send_from_directory(BASE_DIR, 'index.html')


# Serves static assets such as CSS, JS, and data files from the project root.
# This affects resource loading for the entire frontend application.
@app.route('/<path:path>')
def serve_static(path):
    """Serve CSS, JS, HTML, and other static files from the project root."""
    return send_from_directory(BASE_DIR, path)


# Persists the user's updated anime data back into the local data.json file.
# This modifies the local JSON dataset on disk when the user saves changes.
@app.route('/api/save', methods=['POST'])
def save_data():
    """Persist the current anime dataset back into data/data.json."""
    try:
        new_data = request.get_json()
        if not new_data:
            return jsonify({"error": "No data provided"}), 400

        os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)

        # Write to a temporary file first, then replace atomically to prevent corruption.
        temp_file = DATA_FILE + '.tmp'
        with open(temp_file, 'w', encoding='utf-8') as f:
            json.dump(new_data, f, indent=4, ensure_ascii=False)
        os.replace(temp_file, DATA_FILE)

        print(f"Data saved successfully to {DATA_FILE}")
        return jsonify({"message": "Data saved successfully"}), 200
    except Exception as e:
        print(f"Error saving data: {str(e)}")
        return jsonify({"error": str(e)}), 500


# Modifies outgoing responses to add headers that disable browser caching.
# This ensures that frontend changes (CSS/JS) are immediately loaded upon refresh.
@app.after_request
def add_header(response):
    """Add headers to disable caching for local development."""
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, post-check=0, pre-check=0, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response


# Finds the first available TCP port starting from the given port by incrementing it.
# This prevents port conflict errors and ensures the Flask server starts successfully.
def find_free_port(start_port):
    """Find a free port starting from start_port by incrementing by 1."""
    port = start_port
    while True:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(('127.0.0.1', port))
                return port
            except OSError:
                port += 1


# Opens the application's root URL in the user's default web browser at the specified port.
# This triggers a new browser window/tab pointing to the local host address on the active port.
def open_browser(port):
    """Open the app in the default browser after the server starts."""
    webbrowser.open_new(f"http://localhost:{port}")


if __name__ == '__main__':
    port = find_free_port(5000)
    print("---------------------------------------------")
    print("Anime Tracker Server is running!")
    print(f"URL: http://localhost:{port}")
    print("---------------------------------------------")
    Timer(1, lambda: open_browser(port)).start()
    app.run(port=port, debug=True, use_reloader=False)

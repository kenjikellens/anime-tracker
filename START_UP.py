"""
RASCAL Backend Server (Python)
Provides a lightweight HTTP server for local development and
AniList OAuth token exchange. Data is stored on AniList, not locally.
"""

import http.server
import json
import os
import webbrowser
import requests
import urllib.parse

# Server Configuration
PORT = 3000
DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE = os.path.join(DIR, "config.json")

# AniList OAuth Credentials (matches State.js)
ANILIST_CLIENT_ID = '38391'
ANILIST_CLIENT_SECRET = 'jYd6Wg0vRohTyVkYr3KIYOriM6J9gAa3enD246ux'
ANILIST_REDIRECT_URI = 'http://localhost:3000/callback'

class Handler(http.server.SimpleHTTPRequestHandler):
    """
    Custom HTTP Request Handler for RASCAL.
    Serves static files and handles AniList OAuth callback.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIR, **kwargs)

    def do_GET(self):
        """
        Handles GET requests: static files, OAuth callback, and config serving.
        """
        parsed_path = urllib.parse.urlparse(self.path)
        
        # Route: AniList OAuth Callback
        if parsed_path.path == "/callback":
            query = urllib.parse.parse_qs(parsed_path.query)
            code = query.get('code', [None])[0]
            
            if code:
                try:
                    print(f"  [Log] Exchanging code for access token...")
                    payload = {
                        'grant_type': 'authorization_code',
                        'client_id': ANILIST_CLIENT_ID,
                        'client_secret': ANILIST_CLIENT_SECRET,
                        'redirect_uri': ANILIST_REDIRECT_URI,
                        'code': code
                    }
                    
                    response = requests.post('https://anilist.co/api/v2/oauth/token', data=payload)
                    
                    if response.status_code != 200:
                        print(f"  [!] AniList Token Exchange FAILED!")
                        self.send_response(200)
                        self.send_header('Content-Type', 'text/html')
                        self.end_headers()
                        self.wfile.write(f"<h1>Auth Fout!</h1><p><b>Status:</b> {response.status_code}</p><p><b>Bericht:</b> {response.text}</p><a href='/'>Terug naar RASCAL</a>".encode())
                        return

                    token_data = response.json()
                    access_token = token_data.get('access_token')
                    
                    if access_token:
                        config = {}
                        if os.path.exists(CONFIG_FILE):
                            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                                try:
                                    config = json.load(f)
                                except: pass
                        
                        config['anilist_token'] = access_token
                        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
                            json.dump(config, f, indent=4)
                        
                        print(f"  AniList Access Token successfully saved.")
                except Exception as e:
                    print(f"  Error during AniList token exchange: {e}")
            
            # Redirect user back to the application home
            self.send_response(302)
            self.send_header('Location', 'http://localhost:3000/')
            self.end_headers()
            
        # Route: Config Fetching
        elif parsed_path.path == "/config":
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            if os.path.exists(CONFIG_FILE):
                with open(CONFIG_FILE, "rb") as f:
                    self.wfile.write(f.read())
            else:
                self.wfile.write(b'{}')
        else:
            # Standard Static File Serving
            super().do_GET()

    def log_message(self, format, *args):
        """ Suppress default access logs to keep terminal output clean. """
        pass

if __name__ == "__main__":
    print(f"\n  RASCAL Tracker running at: http://localhost:{PORT}")
    print(f"  Data source: AniList API (no local data.json)")
    print(f"  Press Ctrl+C to stop the server.\n")
    
    # Auto-open browser for convenience
    webbrowser.open(f"http://localhost:{PORT}")
    
    try:
        http.server.HTTPServer(("", PORT), Handler).serve_forever()
    except KeyboardInterrupt:
        print("\n  Server stopped by user. Goodbye!")

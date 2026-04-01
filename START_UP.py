import http.server
import json
import os
import webbrowser

PORT = 3000
DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(DIR, "data.json")

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIR, **kwargs)

    def do_POST(self):
        if self.path == "/save":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            with open(DATA_FILE, "w", encoding="utf-8") as f:
                f.write(body.decode("utf-8"))
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"ok":true}')
            print(f"  Data opgeslagen ({length} bytes)")
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass  # stil

print(f"\n  Anime Tracker draait op: http://localhost:{PORT}\n")
webbrowser.open(f"http://localhost:{PORT}")
http.server.HTTPServer(("", PORT), Handler).serve_forever()

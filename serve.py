#!/usr/bin/env python3
"""Threaded HTTP server for hat_site with CSP blocking external requests."""

import http.server
import socketserver
import os

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

CSP = (
    "default-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob: data: mediastream: filesystem:; "
    "img-src 'self' data: blob:; "
    "connect-src 'self' https://*.myshopify.com"
)


http.server.SimpleHTTPRequestHandler.extensions_map[".heic"] = "image/heic"
http.server.SimpleHTTPRequestHandler.extensions_map[".heif"] = "image/heif"


class CSPHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        self.send_header("Content-Security-Policy", CSP)
        super().end_headers()

    def do_POST(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b"{}")


class ThreadedServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True


if __name__ == "__main__":
    server = ThreadedServer(("127.0.0.1", PORT), CSPHandler)
    print(f"Serving {DIRECTORY} at http://localhost:{PORT}")
    print(f"CSP: {CSP}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")

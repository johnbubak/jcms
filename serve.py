#!/usr/bin/env python3
"""
JCMS Dev Server — SPA-fähig
Alle unbekannten Routes → index.html (wie nginx try_files)

Usage: python3 serve.py [port]
Default: http://localhost:8080
"""

import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
DIR  = os.path.dirname(os.path.abspath(__file__))


class SPAHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIR, **kwargs)

    def do_GET(self):
        clean = self.path.split('?')[0].split('#')[0].rstrip('/') or '/'
        fs_path = self.translate_path(clean)

        if os.path.isfile(fs_path):
            return super().do_GET()
        if os.path.isdir(fs_path) and os.path.isfile(os.path.join(fs_path, 'index.html')):
            return super().do_GET()

        # Clean-URL → statische HTML-Seite (Parität zu nginx: /impressum → impressum.html)
        for name in ('impressum', 'datenschutz', 'admin'):
            if clean == f'/{name}' and os.path.isfile(os.path.join(DIR, f'{name}.html')):
                self.path = f'/{name}.html'
                return super().do_GET()

        # SPA-Fallback → index.html
        self.path = '/index.html'
        return super().do_GET()

    def log_message(self, format, *args):
        skip = ('GET /theme/', 'GET /content/', 'GET /assets/', 'GET /app.js', 'GET /favicon')
        if not any(args[0].startswith(s) for s in skip):
            print(f"  {args[0]} → {args[1]}")


# HTTPServer statt TCPServer → hat allow_reuse_address = True eingebaut
class ReusableServer(http.server.HTTPServer):
    allow_reuse_address = True


with ReusableServer(('', PORT), SPAHandler) as httpd:
    print(f"\nJCMS Dev Server: http://localhost:{PORT}/")
    print(f"  /leistungen /projekte /ueber /blog /kontakt — alle routes funktionieren")
    print(f"\nCtrl+C zum Beenden\n")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer gestoppt.")

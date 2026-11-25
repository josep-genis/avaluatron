#!/usr/bin/env python3

"""
Local development server for Avaluatron

This server provides:
- HTTP server for local development
- Mock Supabase endpoints for testing
- CORS headers for browser testing
- Institutional layer testing support

Usage:
    python3 server.py
    # or
    python server.py

Then visit: http://localhost:3000
"""

import http.server
import socketserver
import os
import json
import sys
from pathlib import Path
from urllib.parse import urlparse
from mimetypes import guess_type

PORT = int(os.environ.get('PORT', 3000))
PROJECT_ROOT = Path(__file__).parent

# MIME types for different file extensions
MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
}


class AvaluatroHandler(http.server.SimpleHTTPRequestHandler):
    """Custom HTTP request handler for Avaluatron local dev server"""

    def do_GET(self):
        """Handle GET requests"""
        # Parse URL
        parsed_path = urlparse(self.path)
        pathname = parsed_path.path

        # Handle mock Supabase API requests
        if pathname.startswith('/rest/v1/') or pathname.startswith('/auth/v1/'):
            self.handle_supabase_api(pathname, 'GET')
            return

        # Handle root path
        if pathname == '/' or pathname == '':
            pathname = '/index.html'

        # Serve static files
        self.serve_static_file(pathname)

    def do_POST(self):
        """Handle POST requests"""
        parsed_path = urlparse(self.path)
        pathname = parsed_path.path

        # Handle mock Supabase API requests
        if pathname.startswith('/rest/v1/') or pathname.startswith('/auth/v1/'):
            self.handle_supabase_api(pathname, 'POST')
            return

        # For other POSTs, return 405
        self.send_response(405)
        self.send_header('Content-Type', 'text/plain')
        self.end_headers()
        self.wfile.write(b'405 Method Not Allowed\n')

    def do_OPTIONS(self):
        """Handle CORS preflight requests"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Content-Length', '0')
        self.end_headers()

    def serve_static_file(self, pathname):
        """Serve a static file with proper MIME type"""
        file_path = PROJECT_ROOT / pathname.lstrip('/')

        # Security: prevent directory traversal
        try:
            real_path = file_path.resolve()
            if not str(real_path).startswith(str(PROJECT_ROOT)):
                self.send_response(403)
                self.send_header('Content-Type', 'text/plain')
                self.end_headers()
                self.wfile.write(b'403 Forbidden\n')
                return
        except Exception:
            self.send_response(403)
            self.send_header('Content-Type', 'text/plain')
            self.end_headers()
            self.wfile.write(b'403 Forbidden\n')
            return

        # Check if file or directory exists
        if file_path.is_dir():
            # Try index.html in directory
            index_path = file_path / 'index.html'
            if index_path.exists():
                file_path = index_path
            else:
                self.send_response(404)
                self.send_header('Content-Type', 'text/plain')
                self.end_headers()
                self.wfile.write(b'404 Not Found\n')
                return
        elif not file_path.exists():
            # Try as directory with index.html
            if (file_path.parent / 'index.html').exists():
                file_path = file_path.parent / 'index.html'
            else:
                self.send_response(404)
                self.send_header('Content-Type', 'text/plain')
                self.end_headers()
                self.wfile.write(b'404 Not Found\n')
                return

        # Get MIME type
        mime_type = MIME_TYPES.get(file_path.suffix.lower(), 'application/octet-stream')

        try:
            with open(file_path, 'rb') as f:
                content = f.read()

            self.send_response(200)
            self.send_header('Content-Type', mime_type)
            self.send_header('Content-Length', len(content))
            self.send_header('Cache-Control', 'no-cache')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'text/plain')
            self.end_headers()
            self.wfile.write(f'500 Internal Server Error: {str(e)}\n'.encode())

    def handle_supabase_api(self, pathname, method):
        """Handle mock Supabase API requests"""
        # Mock response based on endpoint
        if pathname == '/rest/v1/institutions' and method == 'GET':
            response = [{
                'id': 'test-institution-1',
                'name': 'Test School',
                'code': 'TEST001',
                'email_domain': 'school.edu',
                'settings': {'theme': 'light'}
            }]
            self.send_json_response(200, response)
        elif pathname == '/rest/v1/user_profiles' and method == 'GET':
            response = []
            self.send_json_response(200, response)
        elif pathname == '/auth/v1/signup' and method == 'POST':
            response = {
                'user': {
                    'id': 'mock-user-id',
                    'email': 'test@example.com',
                    'user_metadata': {},
                    'app_metadata': {}
                },
                'session': {
                    'access_token': 'mock-token',
                    'refresh_token': 'mock-refresh',
                    'expires_in': 3600
                }
            }
            self.send_json_response(200, response)
        elif pathname == '/auth/v1/signin' and method == 'POST':
            response = {
                'user': {
                    'id': 'mock-user-id',
                    'email': 'test@example.com'
                },
                'session': {
                    'access_token': 'mock-token',
                    'refresh_token': 'mock-refresh',
                    'expires_in': 3600
                }
            }
            self.send_json_response(200, response)
        else:
            self.send_json_response(404, {'error': 'Not found'})

    def send_json_response(self, status_code, data):
        """Send a JSON response"""
        body = json.dumps(data).encode('utf-8')
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', len(body))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        """Custom logging format"""
        # Format: [TIME] "METHOD PATH" STATUS SIZE
        sys.stderr.write(f"  {self.client_address[0]} - {format % args}\n")


def run_server():
    """Start the development server"""
    handler = AvaluatroHandler

    with socketserver.TCPServer(("", PORT), handler) as httpd:
        print(f"\n{'=' * 60}")
        print("  AVALUATRÓ - Local Development Server")
        print(f"{'=' * 60}\n")
        print(f"  🚀 Server running at: http://localhost:{PORT}")
        print(f"  📁 Project root: {PROJECT_ROOT}")
        print(f"  🔍 Mock Supabase: Enabled")
        print(f"  📝 Logging: Enabled\n")
        print("  Available routes:")
        print(f"    - http://localhost:{PORT}/ (Main app)")
        print(f"    - http://localhost:{PORT}/index.html (Explicit)")
        print(f"    - http://localhost:{PORT}/rest/v1/* (Mock Supabase)")
        print(f"    - http://localhost:{PORT}/auth/v1/* (Mock Auth)\n")
        print("  Press Ctrl+C to stop the server\n")
        print(f"{'=' * 60}\n")

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\n  Shutting down server...")
            httpd.shutdown()
            print("  Server stopped.\n")


if __name__ == "__main__":
    try:
        run_server()
    except OSError as e:
        if e.errno == 48:  # Port already in use
            print(f"\n❌ Error: Port {PORT} is already in use")
            print(f"   Try: PORT=3001 python3 server.py")
        else:
            print(f"\n❌ Error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        sys.exit(1)

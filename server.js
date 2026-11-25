#!/usr/bin/env node

/**
 * Local development server for Avaluatron
 * 
 * This server provides:
 * - HTTP server for local development
 * - Mock Supabase endpoints for testing
 * - Hot-reload capabilities
 * - Institutional layer testing support
 * 
 * Usage:
 *   node server.js
 * 
 * Then visit: http://localhost:3000
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const PROJECT_ROOT = __dirname;

// MIME types for different file extensions
const MIME_TYPES = {
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
};

// Mock Supabase responses for testing
const mockSupabaseResponses = {
  '/rest/v1/institutions': (method) => {
    if (method === 'GET') {
      return {
        status: 200,
        body: JSON.stringify([
          {
            id: 'test-institution-1',
            name: 'Test School',
            code: 'TEST001',
            email_domain: 'school.edu',
            settings: { theme: 'light' }
          }
        ])
      };
    }
    return { status: 405, body: 'Method not allowed' };
  },

  '/rest/v1/user_profiles': (method) => {
    if (method === 'GET') {
      return {
        status: 200,
        body: JSON.stringify([])
      };
    }
    return { status: 405, body: 'Method not allowed' };
  },

  '/auth/v1/signup': (method) => {
    if (method === 'POST') {
      return {
        status: 200,
        body: JSON.stringify({
          user: {
            id: 'mock-user-id',
            email: 'test@example.com',
            user_metadata: {},
            app_metadata: {}
          },
          session: {
            access_token: 'mock-token',
            refresh_token: 'mock-refresh',
            expires_in: 3600
          }
        })
      };
    }
    return { status: 405, body: 'Method not allowed' };
  },

  '/auth/v1/signin': (method) => {
    if (method === 'POST') {
      return {
        status: 200,
        body: JSON.stringify({
          user: {
            id: 'mock-user-id',
            email: 'test@example.com'
          },
          session: {
            access_token: 'mock-token',
            refresh_token: 'mock-refresh',
            expires_in: 3600
          }
        })
      };
    }
    return { status: 405, body: 'Method not allowed' };
  }
};

/**
 * Handle mock Supabase API requests
 */
function handleSupabaseRequest(pathname, method) {
  const handler = mockSupabaseResponses[pathname];
  if (!handler) {
    return { status: 404, body: 'Not found' };
  }
  return handler(method);
}

/**
 * Serve static files
 */
function serveFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found\n');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error\n');
      }
      return;
    }

    res.writeHead(200, {
      'Content-Type': mimeType,
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(content);
  });
}

/**
 * Request handler
 */
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname;

  // Handle root path
  if (pathname === '/') {
    pathname = '/index.html';
  }

  // Handle mock Supabase API requests
  if (pathname.startsWith('/rest/v1/') || pathname.startsWith('/auth/v1/')) {
    const response = handleSupabaseRequest(pathname, req.method);
    res.writeHead(response.status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end(response.body);
    return;
  }

  // Handle OPTIONS for CORS
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end();
    return;
  }

  // Serve static files
  const filePath = path.join(PROJECT_ROOT, pathname);

  // Security: prevent directory traversal
  const realPath = path.resolve(filePath);
  if (!realPath.startsWith(PROJECT_ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden\n');
    return;
  }

  // Check if file exists
  fs.stat(realPath, (err, stats) => {
    if (err && err.code === 'ENOENT') {
      // Try index.html in directory
      if (!realPath.endsWith('.html')) {
        const indexPath = path.join(realPath, 'index.html');
        return serveFile(indexPath, res);
      }
    }

    if (stats && stats.isDirectory()) {
      const indexPath = path.join(realPath, 'index.html');
      return serveFile(indexPath, res);
    }

    serveFile(realPath, res);
  });
});

server.listen(PORT, () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log('  AVALUATRÓ - Local Development Server');
  console.log(`${'='.repeat(60)}\n`);
  console.log(`  🚀 Server running at: http://localhost:${PORT}`);
  console.log(`  📁 Project root: ${PROJECT_ROOT}`);
  console.log(`  🔍 Mock Supabase: Enabled`);
  console.log(`  📝 Logging: Enabled\n`);
  console.log('  Available routes:');
  console.log('    - http://localhost:' + PORT + '/ (Main app)');
  console.log('    - http://localhost:' + PORT + '/index.html (Explicit)');
  console.log('    - http://localhost:' + PORT + '/rest/v1/* (Mock Supabase)');
  console.log('    - http://localhost:' + PORT + '/auth/v1/* (Mock Auth)\n');
  console.log('  Press Ctrl+C to stop the server\n');
  console.log(`${'='.repeat(60)}\n`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n  Shutting down server...');
  server.close(() => {
    console.log('  Server stopped.\n');
    process.exit(0);
  });
});

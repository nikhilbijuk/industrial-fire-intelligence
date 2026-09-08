/**
 * Minimal Zero-Dependency Local Static Server for Industrial Fire Intelligence Dashboard
 * Serves dashboard files and pre-processed data securely on http://localhost:3000
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const DASHBOARD_DIR = __dirname;
const ROOT_DIR = path.resolve(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  let reqUrl = req.url.split('?')[0];
  if (reqUrl === '/' || reqUrl === '/dashboard' || reqUrl === '/dashboard/') {
    reqUrl = '/index.html';
  }

  // First try resolving within dashboard/ directory
  let filePath = path.join(DASHBOARD_DIR, reqUrl);
  
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    // If not found in dashboard, try resolving from project root (e.g., prototype/data/...)
    filePath = path.join(ROOT_DIR, reqUrl);
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found: ' + reqUrl);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    });

    fs.createReadStream(filePath).pipe(res);
  });
});

function startServer(port) {
  server.listen(port, () => {
    console.log('===============================================================');
    console.log('       INDUSTRIAL FIRE INTELLIGENCE - DASHBOARD ACTIVE         ');
    console.log('===============================================================');
    console.log(`Local URL: http://localhost:${port}`);
    console.log('Serving from: ' + DASHBOARD_DIR);
    console.log('Press Ctrl+C to stop.');
    console.log('===============================================================');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} in use, trying port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

startServer(PORT);

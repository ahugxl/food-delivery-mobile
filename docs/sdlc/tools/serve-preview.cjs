// Local-only preview of the exported SPA. Not a production API server.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../../..', 'artifacts/sdlc-web-preview');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
const server = http.createServer((req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file = path.resolve(root, '.' + pathname);
    if (file !== root && !file.startsWith(root + path.sep)) {
      res.writeHead(403); return res.end('Forbidden');
    }
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      if (path.extname(pathname)) { res.writeHead(404); return res.end('Not found'); }
      file = path.join(root, 'index.html');
    }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  } catch { res.writeHead(400); res.end('Invalid request'); }
});
server.listen(8099, '127.0.0.1', () => console.log('Preview: http://127.0.0.1:8099'));

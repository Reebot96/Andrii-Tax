#!/usr/bin/env node
// Local preview: builds the site, serves dist/ and rebuilds on every change.
// Usage: node dev.js   (then open http://localhost:8080)

const fs = require('fs');
const http = require('http');
const path = require('path');

const PORT = Number(process.env.PORT) || 8080;
const DIST = path.join(__dirname, 'dist');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
};

function safeBuild() {
  try {
    // Reload build.js each time so edits to the builder apply without a restart.
    delete require.cache[require.resolve('./build')];
    require('./build').build();
  } catch (err) {
    console.error('Build error:', err.message);
  }
}

safeBuild();

let timer;
for (const dir of ['src', 'config']) {
  fs.watch(path.join(__dirname, dir), { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(safeBuild, 100);
  });
}
fs.watch(path.join(__dirname, 'build.js'), () => {
  clearTimeout(timer);
  timer = setTimeout(safeBuild, 100);
});

http
  .createServer((req, res) => {
    let file = path.join(DIST, decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(DIST)) return res.writeHead(403).end();
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) {
      const notFound = path.join(DIST, '404.html');
      res.writeHead(404, { 'Content-Type': TYPES['.html'] });
      return res.end(fs.existsSync(notFound) ? fs.readFileSync(notFound) : 'Not found');
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  })
  .listen(PORT, () => console.log(`Preview: http://localhost:${PORT}`));

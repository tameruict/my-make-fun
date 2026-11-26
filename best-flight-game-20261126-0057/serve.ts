import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOST = '127.0.0.1';
const PORT = 8080;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), 'game');

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

createServer((request, response) => {
  const requestUrl = new URL(request.url || '/', `http://${HOST}:${PORT}`);
  let pathname;
  try {
    pathname = decodeURIComponent(requestUrl.pathname);
  } catch (err) {
    response.writeHead(400);
    response.end('bad request');
    return;
  }
  if (pathname === '/' || pathname === '') pathname = '/index.html';
  const filePath = normalize(join(ROOT, pathname));
  if (filePath !== ROOT && !filePath.startsWith(ROOT + sep)) {
    response.writeHead(403);
    response.end('forbidden');
    return;
  }
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    response.writeHead(404);
    response.end('not found');
    return;
  }
  response.writeHead(200, {
    'content-type': CONTENT_TYPES[extname(filePath).toLowerCase()] || 'application/octet-stream',
    'cache-control': 'no-store'
  });
  createReadStream(filePath).pipe(response);
}).listen(PORT, HOST, () => {
  process.stdout.write(`Ridgeline Patrol dev server on http://${HOST}:${PORT}\n`);
});

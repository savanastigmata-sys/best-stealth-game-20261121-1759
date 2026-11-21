// Development server for Nightshade Gallery: serves game/ on localhost so
// the game can be play-tested and screenshotted in a desktop browser.
// Not part of the entry's hand-in; the game itself needs no server.
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = join(here, 'game');
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const path = join(root, url.pathname === '/' ? 'index.html' : url.pathname);
  if (!path.startsWith(root) || !existsSync(path)) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' });
  res.end(readFileSync(path));
});

const port = Number(process.env.PORT || 8080);
server.listen(port, () => {
  console.log(`Nightshade Gallery at http://localhost:${port} — open it in desktop Chrome.`);
});

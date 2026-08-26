/**
 * Static dev server for this project.
 *
 *   node scripts/serve.mjs [port]
 *
 * The point of it over `python -m http.server` or `npx serve` is the caching.
 * Those send `Last-Modified` and no `Cache-Control`, which lets the browser
 * apply heuristic caching: it reuses ES modules and stylesheets from cache
 * without revalidating, so edits to js/ or css/ appear to do nothing and a
 * perfectly good fix looks like a bug. `no-store` makes every reload honest.
 *
 * Node only, no dependencies.
 */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath rather than picking apart .pathname: this project lives in a
// folder with a space in the name, which arrives percent-encoded.
const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.argv[2] ?? 8080);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

const server = http.createServer(async (req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  // Strip any leading ../ so a request cannot climb out of the project.
  const rel = normalize(url === '/' ? 'index.html' : url.slice(1)).replace(/^(\.\.[\\/])+/, '');
  const file = join(ROOT, rel);

  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end('forbidden');
    return;
  }

  try {
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(rel).toLowerCase()] ?? 'application/octet-stream',
      // The whole reason this file exists.
      'Cache-Control': 'no-store, must-revalidate',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end(`not found: ${rel}`);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Onscreen Socials → http://127.0.0.1:${PORT}/`);
  console.log('Serving with Cache-Control: no-store, so edits always show up.');
});

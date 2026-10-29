// Local preview: serves the site and runs the /api functions like Vercel does.
//   npm run dev                      → library stays in your browser (no sync)
//   SW_DEV_MEMORY=1 STEVIE_PASSCODE=test npm run dev  → try sync with a throwaway in-memory store
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const apiRoot = path.resolve('api');
const port = Number(process.env.PORT || 4173);
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.md': 'text/plain' };

function vercelish(req, res, url, body) {
  req.query = Object.fromEntries(url.searchParams);
  const type = req.headers['content-type'] || '';
  req.body = type.includes('application/json') ? (() => { try { return JSON.parse(body || '{}'); } catch { return body; } })() : body;
  res.status = code => { res.statusCode = code; return res; };
  res.json = data => { if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); return res; };
  res.send = data => { res.end(data); return res; };
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) {
      const name = url.pathname.slice(5).replace(/[^a-z-]/g, '');
      const chunks = [];
      for await (const c of req) chunks.push(c);
      vercelish(req, res, url, Buffer.concat(chunks).toString('utf8'));
      const mod = await import(pathToFileURL(path.join(apiRoot, `${name}.js`)).href);
      await mod.default(req, res);
      return;
    }
    const pathname = decodeURIComponent(url.pathname);
    let file = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    let data;
    try { data = await readFile(file); } catch { file = path.join(root, 'index.html'); data = await readFile(file); }
    if (pathname === '/sw.js') data = Buffer.from(String(data).replace('__VERSION__', 'dev'));
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(data);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) res.writeHead(500).end('Server error');
  }
}).listen(port, '127.0.0.1', () => console.log(`Stevies World: http://127.0.0.1:${port}`));

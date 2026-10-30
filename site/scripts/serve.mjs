// Local preview: the page from site/, files/ straight from the course folders.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { site, content, writeCatalog } from './catalog.mjs';
const port = Number(process.env.PORT || 43873);
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.pdf':'application/pdf', '.bcmap':'application/octet-stream' };
const inside = (root, path) => { const file = resolve(root, '.' + path); return file.startsWith(root + sep) ? file : null; };
http.createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (path === '/materials.json') await writeCatalog();
    if (path.endsWith('/')) path += 'index.html';
    const file = path.startsWith('/files/') ? inside(content, path.slice(6))
      : !/^\/(dist|scripts|tests)\//.test(path) ? inside(site, path) : null;
    const section = path.startsWith('/files/') ? path.split('/')[2] : '';
    if (!file || ['site', '.git', '.github'].includes(section)) { res.writeHead(403).end(); return; }
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch { res.writeHead(404).end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Department: http://127.0.0.1:${port}`));

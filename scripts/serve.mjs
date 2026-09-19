import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const root = resolve('out');
const port = Number(process.env.PORT || 3001);
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.ico':'image/x-icon', '.woff2':'font/woff2', '.txt':'text/plain; charset=utf-8' };
try { await stat(resolve(root, 'index.html')); }
catch { console.error('Build the static app first: npm run build'); process.exit(1); }

http.createServer(async (request, response) => {
  if (!['GET','HEAD'].includes(request.method)) {
    response.writeHead(405, {Allow:'GET, HEAD'}); response.end(); return;
  }
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
  catch { response.writeHead(400); response.end('Invalid URL'); return; }
  const target = resolve(root, `.${pathname}`);
  if (target !== root && !target.startsWith(root + sep)) {
    response.writeHead(403); response.end('Forbidden'); return;
  }
  for (const file of [target, `${target}.html`, resolve(target, 'index.html')]) {
    try {
      if (!(await stat(file)).isFile()) continue;
      const body = await readFile(file);
      response.writeHead(200, {'Content-Type':types[extname(file)] || 'application/octet-stream', 'Cache-Control':'no-cache'});
      response.end(request.method === 'HEAD' ? undefined : body); return;
    } catch { /* Try the clean-URL or directory form. */ }
  }
  response.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'});
  response.end('Page not found');
}).listen(port, '127.0.0.1', () => console.log(`GimmeABreak: http://127.0.0.1:${port}`));

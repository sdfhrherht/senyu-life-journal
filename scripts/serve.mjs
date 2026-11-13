import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { watch } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.PORT || 4173);
const clients = new Set();
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.mp4': 'video/mp4' };
const liveReload = `<script>const updates=new EventSource('/__reload');updates.onmessage=()=>location.reload();</script>`;

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname === '/__reload') {
      response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      response.write(': connected\n\n');
      clients.add(response);
      request.on('close', () => clients.delete(response));
      return;
    }
    const pathname = decodeURIComponent(url.pathname);
    const file = path.resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
    const relative = path.relative(root, file);
    if (relative.startsWith('..') || path.isAbsolute(relative) || !['index.html', 'assets'].includes(relative.split(path.sep)[0])) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    if (!(await stat(file)).isFile()) throw new Error('Not a file');
    const extension = path.extname(file);
    let body = await readFile(file);
    if (extension === '.html') body = Buffer.from(body.toString().replace('</body>', liveReload + '</body>'));
    const headers = { 'Content-Type': types[extension] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'Content-Length': body.length, 'Accept-Ranges': 'bytes' };
    if (request.headers.range && extension !== '.html') {
      const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
      let start = range?.[1] ? Number(range[1]) : 0;
      let end = range?.[2] ? Number(range[2]) : body.length - 1;
      if (range && !range[1] && range[2]) { start = Math.max(0, body.length - Number(range[2])); end = body.length - 1; }
      end = Math.min(end, body.length - 1);
      if (!range || (!range[1] && !range[2]) || start > end || start >= body.length) {
        response.writeHead(416, { 'Content-Range': `bytes */${body.length}` }).end();
        return;
      }
      response.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${body.length}`, 'Content-Length': end - start + 1 });
      response.end(request.method === 'HEAD' ? undefined : body.subarray(start, end + 1));
      return;
    }
    response.writeHead(200, headers);
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response.writeHead(404).end('Not found');
  }
});

let reloadTimer;
const watcher = watch(root, { recursive: true }, (_, filename) => {
  if (!filename || !/^(index\.html|assets[\\/])/.test(filename)) return;
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => clients.forEach(client => client.write('data: reload\n\n')), 120);
});
server.on('error', error => { console.error(error.message); watcher.close(); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${port}`));
process.on('SIGINT', () => { watcher.close(); for (const client of clients) client.end(); server.close(); });

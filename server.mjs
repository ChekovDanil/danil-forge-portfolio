import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT ?? 3070);
const types = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
};
const headers = {
  'Content-Security-Policy': "default-src 'self'; style-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

createServer((request, response) => {
  if (!['GET', 'HEAD'].includes(request.method ?? 'GET')) {
    response.writeHead(405, { ...headers, Allow: 'GET, HEAD' });
    response.end();
    return;
  }

  try {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const relative = url.pathname === '/'
      ? 'public/index.html'
      : decodeURIComponent(url.pathname).replace(/^[/\\]+/, '');
    const file = normalize(join(root, relative));

    if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
      response.writeHead(404, headers);
      response.end('Not found');
      return;
    }

    response.writeHead(200, {
      ...headers,
      'Content-Type': types[extname(file).toLowerCase()] ?? 'application/octet-stream',
    });
    if (request.method === 'HEAD') response.end();
    else createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404, headers);
    response.end('Not found');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Portfolio showcase: http://127.0.0.1:${port}`);
});

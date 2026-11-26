import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path';

const root = resolve('dist/web');
const mediaTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
};

export async function serveWeb(request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }

  try {
    if (!request.url?.startsWith('/') || request.url.startsWith('//')) {
      response.writeHead(404).end('Not found');
      return;
    }
    const url = new URL(request.url, 'http://127.0.0.1');
    const decoded = decodeURIComponent(url.pathname);
    let file = resolve(root, '.' + decoded);
    const path = relative(root, file);
    if (decoded.includes('\\') || decoded.includes('\0') || path === '..' || path.startsWith('..' + sep) || isAbsolute(path)) {
      response.writeHead(404).end('Not found');
      return;
    }
    if ((await stat(file)).isDirectory()) {
      if (!url.pathname.endsWith('/')) {
        response.writeHead(308, { Location: url.pathname + '/' + url.search }).end();
        return;
      }
      file = join(file, 'index.html');
    }
    const body = await readFile(file);
    response.writeHead(200, {
      'Content-Type': mediaTypes[extname(file)] ?? 'application/octet-stream',
      'Content-Length': body.length,
      'Cache-Control': 'no-cache',
    }).end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response.writeHead(404).end('Not found');
  }
}

if (import.meta.main) {
  const port = Number(process.env.PORT || '8000');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535.');
  const server = createServer(serveWeb);
  server.on('error', error => {
    console.error(`Could not start the website preview: ${error.message}`);
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`PromptVeil preview at http://127.0.0.1:${port}/`);
  });
}

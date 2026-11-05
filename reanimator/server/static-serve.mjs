#!/usr/bin/env node
// Serves a built body that has no start script (R9, D-R23): `node static-serve.mjs <root>` on
// $HOST:$PORT. Files under root only; "/" and folders give their index.html; anything else is 404.
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json',
  '.woff2': 'font/woff2',
};

async function fileFor(urlPath) {
  let path;
  try {
    path = decodeURIComponent(new URL(urlPath, 'http://x').pathname);
  } catch {
    return null;
  }
  let file = resolve(join(root, path));
  if (file !== root && !file.startsWith(root + sep)) return null;
  const s = await stat(file).catch(() => null);
  if (s?.isDirectory()) file = join(file, 'index.html');
  const f = await stat(file).catch(() => null);
  return f?.isFile() ? file : null;
}

createServer((req, res) => {
  void fileFor(req.url ?? '/').then((file) => {
    if (!file) {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
}).listen(Number(process.env.PORT ?? 8080), process.env.HOST ?? '127.0.0.1');

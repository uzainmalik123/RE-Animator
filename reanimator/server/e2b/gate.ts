// The gate in front of a hosted Reanimator (E2B, D-R26). The backend's loopback guard (KI-R12) stays
// as it is; this gate is the only thing facing the sandbox's public URL. It lets in only callers who
// hold the key (once as ?key=, then an HttpOnly cookie), serves the built UI, and forwards /api to
// the backend on loopback with loopback Host/Origin, so the guard sees a local caller.
import { timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer, request, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';

const COOKIE = 'reanimator_key';
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

export interface GateOpts {
  key: string;
  root: string; // the built UI (dist/)
  backend: { host: string; port: number };
}

function sameKey(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function cookieKey(header: string | undefined): string | null {
  for (const part of (header ?? '').split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === COOKIE) return decodeURIComponent(rest.join('='));
  }
  return null;
}

async function fileFor(root: string, pathname: string): Promise<string | null> {
  let path: string;
  try {
    path = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  let file = resolve(join(root, path));
  if (file !== root && !file.startsWith(root + sep)) return null;
  if ((await stat(file).catch(() => null))?.isDirectory()) file = join(file, 'index.html');
  if ((await stat(file).catch(() => null))?.isFile()) return file;
  // A path with no extension is a page of the app; anything else really is missing.
  return extname(path) ? null : join(root, 'index.html');
}

function forward(req: IncomingMessage, res: ServerResponse, o: GateOpts): void {
  const headers = { ...req.headers, host: `${o.backend.host}:${o.backend.port}` };
  // The backend gets no browser identity from the public side: no Origin, Referer or our cookie.
  delete headers.origin;
  delete headers.referer;
  delete headers.cookie;
  const up = request({ host: o.backend.host, port: o.backend.port, method: req.method, path: req.url, headers }, (r) => {
    res.writeHead(r.statusCode ?? 502, r.headers);
    r.pipe(res); // streams SSE as it comes
  });
  up.on('error', () => {
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain' });
    res.end('backend unreachable');
  });
  res.on('close', () => up.destroy());
  req.pipe(up);
}

export function createGate(o: GateOpts): Server {
  const root = resolve(o.root);
  return createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? '/', 'http://gate');
      const asked = url.searchParams.get('key');
      if (asked !== null && sameKey(asked, o.key)) {
        url.searchParams.delete('key');
        res.writeHead(303, {
          location: url.pathname + url.search,
          'set-cookie': `${COOKIE}=${encodeURIComponent(o.key)}; HttpOnly; Secure; SameSite=Strict; Path=/`,
        });
        res.end();
        return;
      }
      const held = cookieKey(req.headers.cookie);
      if (held === null || !sameKey(held, o.key)) {
        res.writeHead(401, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('The crypt is sealed. Open the link with its key.');
        return;
      }
      if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return forward(req, res, o);
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405).end();
        return;
      }
      const file = await fileFor(root, url.pathname);
      if (!file) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
      if (req.method === 'HEAD') res.end();
      else createReadStream(file).pipe(res);
    })().catch(() => {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  });
}

// `tsx server/e2b/gate.ts`, inside the sandbox: REANIMATOR_GATE_KEY is required.
if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const key = process.env.REANIMATOR_GATE_KEY;
  if (!key || key.length < 16) throw new Error('REANIMATOR_GATE_KEY (16+ chars) is required');
  const port = Number(process.env.REANIMATOR_GATE_PORT ?? 8080);
  createGate({ key, root: new URL('../../dist', import.meta.url).pathname, backend: { host: '127.0.0.1', port: Number(process.env.REANIMATOR_PORT ?? 7070) } })
    .listen(port, '0.0.0.0', () => console.log(`Reanimator gate on :${port}`));
}

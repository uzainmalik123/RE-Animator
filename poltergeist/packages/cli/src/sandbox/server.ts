import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { UsageError } from '@poltergeist/core';
import { WebSocketServer } from 'ws';
import { clientKey, createRateLimiter } from './limit.js';
import { SandboxBusyError, SandboxClosedError, SandboxRuns, type SandboxRunsOptions } from './runs.js';

/** The sandbox's HTTP + WebSocket port (F21, D-49; STACK). */
export const SANDBOX_PORT = 6662;

/** A run request is tiny; anything bigger is refused unread. */
const MAX_BODY = 4096;
const MAX_IDS = 64;
const MAX_ID_LENGTH = 32;
/** Live sockets across every kept run; more are refused with 503. */
export const MAX_LIVE_CLIENTS = 200;

export type SandboxOptions = SandboxRunsOptions & {
  /** Default 127.0.0.1. */
  host?: string;
  /** Default 6662; 0 picks a free port. */
  port?: number;
  /** Runs per client per sliding hour; 0 = unlimited. */
  perClientHour: number;
  /** Key clients by the first `X-Forwarded-For` hop (only behind a proxy you run). */
  trustProxy: boolean;
  /** Default `MAX_LIVE_CLIENTS`. */
  maxClients?: number;
  /** Tests only. */
  now?: () => number;
};

export type Sandbox = { url: string; close(): Promise<void> };

class BodyError extends Error {
  constructor(readonly status: 400 | 413, message: string) {
    super(message);
  }
}

function send(res: ServerResponse, status: number, body?: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, {
    'access-control-allow-origin': '*',
    'cache-control': 'no-store',
    ...(body !== undefined ? { 'content-type': 'application/json; charset=utf-8' } : {}),
    ...headers,
  });
  res.end(body !== undefined ? JSON.stringify(body) : undefined);
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > MAX_BODY) throw new BodyError(413, `request body over ${MAX_BODY} bytes`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

const isIdList = (v: unknown): v is string[] =>
  Array.isArray(v) && v.length >= 1 && v.length <= MAX_IDS && v.every((s) => typeof s === 'string' && s.length >= 1 && s.length <= MAX_ID_LENGTH);

/** `{}` or `{only?, personas?}`, each 1–64 ids of 1–32 characters. Everything else about a run is the operator's. */
function parseRunRequest(text: string): { only?: string[]; personas?: string[] } {
  if (text.trim() === '') return {};
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new BodyError(400, 'body must be JSON');
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new BodyError(400, 'body must be a JSON object');
  const fields = body as Record<string, unknown>;
  const extra = Object.keys(fields).find((k) => k !== 'only' && k !== 'personas');
  if (extra !== undefined) throw new BodyError(400, `unknown field: ${extra.slice(0, MAX_ID_LENGTH)} (only "only" and "personas" can be chosen)`);
  for (const k of ['only', 'personas'] as const) {
    if (fields[k] !== undefined && !isIdList(fields[k])) throw new BodyError(400, `${k} must be 1–${MAX_IDS} ids of 1–${MAX_ID_LENGTH} characters`);
  }
  return { ...(fields.only ? { only: fields.only as string[] } : {}), ...(fields.personas ? { personas: fields.personas as string[] } : {}) };
}

/**
 * `poltergeist sandbox` (PRD F21, D-49): strangers may start a haunting of the operator's one spec, from cached
 * plans only, one at a time, rate-limited per client, and watch it on the live feed. Any origin may call it: there
 * are no credentials to steal and nothing to change but which criteria and personas run.
 */
export async function startSandbox(opts: SandboxOptions): Promise<Sandbox> {
  const host = opts.host ?? '127.0.0.1';
  const port = opts.port ?? SANDBOX_PORT;
  const runs = new SandboxRuns(opts);
  const limiter = createRateLimiter({ perHour: opts.perClientHour, ...(opts.now ? { now: opts.now } : {}) });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 });

  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    const path = new URL(req.url ?? '/', 'http://sandbox').pathname;
    if (req.method === 'OPTIONS') {
      send(res, 204, undefined, { 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '600' });
      return;
    }
    if (path === '/health') {
      if (req.method !== 'GET') return send(res, 405, { error: 'method not allowed' }, { allow: 'GET' });
      const active = runs.activeId();
      return send(res, 200, { ok: true, busy: active !== undefined, activeRunId: active ?? null, runs: runs.list().length });
    }
    if (path === '/runs') {
      if (req.method === 'GET') return send(res, 200, { runs: runs.list() });
      if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' }, { allow: 'GET, POST' });
      let wanted;
      try {
        wanted = parseRunRequest(await readBody(req));
      } catch (err) {
        if (err instanceof BodyError) return send(res, err.status, { error: err.message }, err.status === 413 ? { connection: 'close' } : {});
        throw err;
      }
      const active = runs.activeId();
      if (active !== undefined) return send(res, 409, { error: 'busy', runId: active });
      const key = clientKey(req, opts.trustProxy);
      const allowed = limiter.check(key);
      if (!allowed.ok) return send(res, 429, { error: 'rate limited', retryAfterSec: allowed.retryAfterSec }, { 'retry-after': String(allowed.retryAfterSec) });
      try {
        const runId = await runs.start(wanted);
        limiter.record(key);
        const at = `/runs/${encodeURIComponent(runId)}`;
        return send(res, 202, { runId, status: at, live: `${at}/live` });
      } catch (err) {
        if (err instanceof SandboxBusyError) return send(res, 409, { error: 'busy', runId: err.activeRunId });
        if (err instanceof SandboxClosedError) return send(res, 503, { error: 'shutting down' });
        // Usage errors name criteria and personas; one that names a local path (a spec edited while serving) doesn't go out.
        if (err instanceof UsageError) return send(res, 400, { error: /[/\\]/.test(err.message) ? 'bad request' : err.message });
        return send(res, 500, { error: 'run failed' });
      }
    }
    const runPath = /^\/runs\/([^/]+)$/.exec(path);
    const run = runPath ? runs.get(safeDecode(runPath[1]!)) : undefined;
    if (runPath && run) {
      if (req.method !== 'GET') return send(res, 405, { error: 'method not allowed' }, { allow: 'GET' });
      return send(res, 200, run.summary);
    }
    return send(res, 404, { error: 'not found' });
  };

  const server = createServer((req, res) => {
    handle(req, res).catch((err: unknown) => {
      opts.log?.(`error: ${err instanceof Error ? err.message : String(err)}`);
      if (!res.headersSent) send(res, 500, { error: 'internal error' });
      else res.destroy();
    });
  });
  server.on('upgrade', (req, socket, head) => {
    const live = /^\/runs\/([^/]+)\/live$/.exec(new URL(req.url ?? '/', 'http://sandbox').pathname);
    const run = live ? runs.get(safeDecode(live[1]!)) : undefined;
    if (!run) {
      socket.end('HTTP/1.1 404 Not Found\r\nconnection: close\r\ncontent-length: 0\r\n\r\n');
      return;
    }
    if (wss.clients.size >= (opts.maxClients ?? MAX_LIVE_CLIENTS)) {
      socket.end('HTTP/1.1 503 Service Unavailable\r\nconnection: close\r\ncontent-length: 0\r\n\r\n');
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => run.broadcast.attach(ws));
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', (err: NodeJS.ErrnoException) => reject(err.code === 'EADDRINUSE' ? new UsageError(`port ${port} is in use`) : err));
    server.listen(port, host, () => resolve());
  });
  const address = server.address();
  const actual = typeof address === 'object' && address ? address.port : port;
  const shown = host.includes(':') ? `[${host}]` : host;
  return {
    url: `http://${shown}:${actual}`,
    async close() {
      // Stop taking connections first, so nothing can start a run while the active one drains.
      const closed = new Promise<void>((resolve) => server.close(() => resolve()));
      await runs.close();
      for (const ws of wss.clients) ws.terminate();
      server.closeAllConnections();
      await closed;
    },
  };
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return '';
  }
}

import { UsageError, type LiveHello, type SummonEvent } from '@poltergeist/core';
import { WebSocketServer } from 'ws';
import { createLiveBroadcast } from './live-broadcast.js';

/** The runner WebSocket port (design §8, STACK). */
export const SEANCE_EVENT_PORT = 6660;

/**
 * Loopback binding doesn't stop a web page in the user's browser from connecting, so browser clients
 * must come from a loopback origin (the Séance on :6661, a dev server). Non-browser clients send none.
 */
function allowedOrigin(origin: string | undefined): boolean {
  if (origin === undefined) return true;
  try {
    const { hostname, protocol } = new URL(origin);
    return (protocol === 'http:' || protocol === 'https:') && ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
  } catch {
    return false;
  }
}

export type EventServer = {
  url: string;
  publish(e: SummonEvent): void;
  /** Resolves when the first client connects (replay waits for it, F15). */
  firstClient(): Promise<void>;
  close(): Promise<void>;
};

/**
 * `--seance` only (PRD F09/F12, D-36, D-40): broadcasts every event on `ws://127.0.0.1:<port>/runs/<runId>`.
 * The backlog, frame and backpressure rules are `createLiveBroadcast`'s. Loopback only; other paths are refused.
 */
export async function startEventServer(
  runId: string,
  opts: { port?: number; host?: string; maxBuffered?: number; hello?: Pick<LiveHello, 'recorded' | 'speed'> } = {},
): Promise<EventServer> {
  const host = opts.host ?? '127.0.0.1';
  const port = opts.port ?? SEANCE_EVENT_PORT;
  const path = `/runs/${encodeURIComponent(runId)}`;
  const wss = new WebSocketServer({ host, port, path, maxPayload: 1024, verifyClient: ({ origin }: { origin?: string }) => allowedOrigin(origin) });
  await new Promise<void>((resolve, reject) => {
    wss.once('listening', resolve);
    wss.once('error', (err: NodeJS.ErrnoException) => {
      wss.close();
      reject(err.code === 'EADDRINUSE' ? new UsageError(`port ${port} is in use; is another summon --seance running?`) : err);
    });
  });
  const broadcast = createLiveBroadcast(runId, { maxBuffered: opts.maxBuffered, hello: opts.hello });
  let connected!: () => void;
  const first = new Promise<void>((r) => (connected = r));
  wss.on('connection', (ws) => {
    connected();
    broadcast.attach(ws);
  });
  const address = wss.address();
  const actual = typeof address === 'object' && address ? address.port : port;
  return {
    url: `ws://${host}:${actual}${path}`,
    publish: (e) => broadcast.publish(e),
    firstClient: () => first,
    close() {
      broadcast.closeAll(1001, 'run finished');
      return new Promise((resolve) => wss.close(() => resolve()));
    },
  };
}

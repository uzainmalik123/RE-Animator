import { LIVE_PROTOCOL, type LiveHello, type SummonEvent } from '@poltergeist/core';
import { WebSocket } from 'ws';

/** A client with more than this queued (bytes) is sent no frames until it drains (KI-43, D-40). */
export const MAX_BUFFERED = 1_048_576;

export type LiveBroadcast = {
  /** Sends `live.hello`, then the backlog, then every later event until the socket closes. */
  attach(ws: WebSocket): void;
  publish(e: SummonEvent): void;
  clientCount(): number;
  closeAll(code?: number, reason?: string): void;
  /** The run is over: closes every client, and later clients get the hello and backlog, then the same close. */
  end(code: number, reason: string): void;
};

/**
 * One run's live feed (D-40), shared by `--seance`, `replay` and the sandbox (F21). Late joiners get hello, then the
 * events so far with each ghost's latest frame kept in place, so `foldLive` reaches the same board and evidence.
 * A finished rep's frames are dropped, except those of ghosts that failed an assertion (the haunted evidence).
 * A slow client loses frames, never other events.
 */
export function createLiveBroadcast(
  runId: string,
  opts: { maxBuffered?: number; hello?: Pick<LiveHello, 'recorded' | 'speed'> } = {},
): LiveBroadcast {
  const maxBuffered = opts.maxBuffered ?? MAX_BUFFERED;
  const clients = new Set<WebSocket>();
  let ended: { code: number; reason: string } | undefined;
  /** Every event so far; a ghost's superseded frames become holes, so the latest stays where it arrived. */
  const backlog: (string | undefined)[] = [];
  const ghosts = new Map<string, { criterion: string; persona: string; rep: number; failed: boolean }>();
  const frameAt = new Map<string, number>();
  const dropFrame = (ghostId: string) => {
    const i = frameAt.get(ghostId);
    if (i !== undefined) backlog[i] = undefined;
    frameAt.delete(ghostId);
  };
  return {
    attach(ws) {
      clients.add(ws);
      ws.on('close', () => clients.delete(ws));
      ws.on('error', () => ws.terminate()); // a malformed frame from one client must not crash the run
      ws.send(JSON.stringify({ type: 'live.hello', protocol: LIVE_PROTOCOL, runId, t: Date.now(), ...opts.hello } satisfies LiveHello));
      for (const line of backlog) if (line !== undefined) ws.send(line);
      if (ended) ws.close(ended.code, ended.reason);
    },
    publish(e) {
      const line = JSON.stringify(e);
      const isFrame = e.type === 'ghost.frame';
      if (isFrame) {
        if (ghosts.has(e.ghostId)) {
          dropFrame(e.ghostId);
          frameAt.set(e.ghostId, backlog.push(line) - 1);
        }
      } else {
        backlog.push(line);
        if (e.type === 'ghost.spawned') ghosts.set(e.ghostId, { criterion: e.criterion, persona: e.persona, rep: e.rep, failed: false });
        if (e.type === 'assert.result' && !e.ok) {
          for (const g of ghosts.values()) if (g.criterion === e.criterion && g.persona === e.persona && g.rep === e.rep) g.failed = true;
        }
        if (e.type === 'rep.finished') {
          for (const [id, g] of ghosts) {
            if (g.rep !== e.rep) continue;
            ghosts.delete(id);
            if (g.failed) frameAt.delete(id); // keep its last frame for good: it may be the evidence
            else dropFrame(id);
          }
        }
      }
      for (const client of clients) {
        if (client.readyState !== WebSocket.OPEN) continue;
        if (isFrame && client.bufferedAmount > maxBuffered) continue;
        client.send(line);
      }
    },
    clientCount: () => clients.size,
    closeAll(code, reason) {
      // A graceful close flushes queued events (run.finished) before the socket goes.
      for (const client of clients) client.close(code, reason);
    },
    end(code, reason) {
      ended = { code, reason };
      for (const client of clients) client.close(code, reason);
    },
  };
}

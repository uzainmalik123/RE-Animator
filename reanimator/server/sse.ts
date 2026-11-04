import type { Context } from 'hono';
import { streamSSE } from 'hono/streaming';

// Anything whose events can be replayed by id and followed live (Rituals, Attacks).
export interface LogSource<E> {
  events(id: string, after?: number): { log: E[]; done: boolean } | null;
  subscribe(id: string, fn: (e: E, index: number) => void): () => void;
}

// Stream a log as SSE with `id: <index>`, so a reconnecting EventSource resumes from Last-Event-ID
// instead of replaying (and double-counting). A negative id is a fresh start (KI-R14 #2).
export function streamLog<E>(c: Context, src: LogSource<E>, id: string, isTerminal: (e: E) => boolean, notFound: string): Response | Promise<Response> {
  const lastId = Number.parseInt(c.req.header('last-event-id') ?? '', 10);
  const after = Number.isFinite(lastId) ? Math.max(-1, lastId) : -1;
  const first = src.events(id, after);
  if (!first) return c.json({ error: notFound }, 404);

  return streamSSE(c, async (stream) => {
    let next = after + 1;
    const send = (e: E, index: number) => {
      if (index < next) return Promise.resolve();
      next = index + 1;
      return stream.writeSSE({ id: String(index), data: JSON.stringify(e) });
    };
    // Subscribe before replaying so nothing slips between the replay and the live feed.
    const queue: Array<[E, number]> = [];
    let wake: (() => void) | null = null;
    const off = src.subscribe(id, (e, i) => {
      queue.push([e, i]);
      wake?.();
    });
    stream.onAbort(() => {
      off();
      wake?.();
    });
    try {
      const replay = src.events(id, after) ?? first;
      for (let k = 0; k < replay.log.length; k++) await send(replay.log[k]!, after + 1 + k);
      let done = replay.done;
      while (!done && !stream.aborted) {
        if (queue.length === 0) await new Promise<void>((r) => (wake = r));
        wake = null;
        for (const [e, i] of queue.splice(0)) {
          await send(e, i);
          if (isTerminal(e)) done = true;
        }
      }
    } finally {
      off();
    }
  });
}

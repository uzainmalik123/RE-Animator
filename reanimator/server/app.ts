import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { RitualEvent } from '../shared/ritual.js';
import { loopbackGuard } from './guard.js';
import type { Rituals } from './ritual.js';

export type RitualsApi = Pick<Rituals, 'start' | 'events' | 'subscribe'>;

const terminal = (e: RitualEvent) => e.type === 'risen' || e.type === 'failed';

// The backend's routes. Every /api route is loopback-only (KI-R12). R2 adds the ritual: POST starts
// one, and its events stream as SSE with `id: <index>` so a reconnecting EventSource resumes from
// Last-Event-ID instead of replaying (and double-counting) vitals.
export function createApp(o: { rituals?: RitualsApi } = {}): Hono {
  const app = new Hono();
  app.use('/api/*', loopbackGuard());
  app.get('/api/health', (c) => c.json({ ok: true, name: 'reanimator' }));

  const rituals = o.rituals;
  if (!rituals) return app;

  app.post('/api/rituals', (c) => {
    const s = rituals.start();
    if ('busy' in s) return c.json({ error: 'a ritual is already running', id: s.id }, 409);
    return c.json({ id: s.id }, 202);
  });

  app.get('/api/rituals/:id/events', (c) => {
    const id = c.req.param('id');
    const lastId = Number.parseInt(c.req.header('last-event-id') ?? '', 10);
    const after = Number.isFinite(lastId) ? lastId : -1;
    const first = rituals.events(id, after);
    if (!first) return c.json({ error: 'no such ritual' }, 404);

    return streamSSE(c, async (stream) => {
      let next = after + 1;
      const send = (e: RitualEvent, index: number) => {
        if (index < next) return Promise.resolve();
        next = index + 1;
        return stream.writeSSE({ id: String(index), data: JSON.stringify(e) });
      };
      // Subscribe before replaying so nothing slips between the replay and the live feed.
      const queue: Array<[RitualEvent, number]> = [];
      let wake: (() => void) | null = null;
      const off = rituals.subscribe(id, (e, i) => {
        queue.push([e, i]);
        wake?.();
      });
      stream.onAbort(() => {
        off();
        wake?.();
      });
      try {
        const replay = rituals.events(id, after) ?? first;
        for (let k = 0; k < replay.log.length; k++) await send(replay.log[k]!, after + 1 + k);
        let done = replay.done;
        while (!done && !stream.aborted) {
          if (queue.length === 0) await new Promise<void>((r) => (wake = r));
          wake = null;
          for (const [e, i] of queue.splice(0)) {
            await send(e, i);
            if (terminal(e)) done = true;
          }
        }
      } finally {
        off();
      }
    });
  });

  return app;
}

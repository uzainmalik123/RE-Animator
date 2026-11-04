import { Hono } from 'hono';
import type { RitualEvent } from '../shared/ritual.js';
import { loopbackGuard } from './guard.js';
import type { Rituals } from './ritual.js';
import { streamLog } from './sse.js';

export type RitualsApi = Pick<Rituals, 'start' | 'events' | 'subscribe'>;

const terminal = (e: RitualEvent) => e.type === 'risen' || e.type === 'failed';

// The backend's routes. Every /api route is loopback-only (KI-R12). R2 adds the ritual: POST starts
// one, and its events stream as resumable SSE (sse.ts).
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

  app.get('/api/rituals/:id/events', (c) => streamLog(c, rituals, c.req.param('id'), terminal, 'no such ritual'));

  return app;
}

import { Hono } from 'hono';
import { attackOver } from '../shared/attack.js';
import type { RitualEvent } from '../shared/ritual.js';
import type { Attacks } from './attack.js';
import { loopbackGuard } from './guard.js';
import type { Rituals } from './ritual.js';
import { streamLog } from './sse.js';

export type RitualsApi = Pick<Rituals, 'start' | 'events' | 'subscribe'>;
export type AttacksApi = Pick<Attacks, 'start' | 'events' | 'subscribe' | 'frame'>;

const terminal = (e: RitualEvent) => e.type === 'risen' || e.type === 'failed';

// The backend's routes. Every /api route is loopback-only (KI-R12). R2 adds the ritual: POST starts
// one, and its events stream as resumable SSE (sse.ts). R3 adds Death's attack on a risen ritual.
export function createApp(o: { rituals?: RitualsApi; attacks?: AttacksApi } = {}): Hono {
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

  const attacks = o.attacks;
  if (!attacks) return app;

  app.post('/api/rituals/:id/attack', async (c) => {
    const body: unknown = await c.req.json().catch(() => ({}));
    const only = typeof body === 'object' && body !== null ? (body as { only?: unknown }).only : undefined;
    if (only !== undefined && !(Array.isArray(only) && only.every((x) => typeof x === 'string' && x !== ''))) {
      return c.json({ error: 'only must be a list of criterion ids' }, 400);
    }
    const s = attacks.start(c.req.param('id'), only as string[] | undefined);
    if ('notRisen' in s) return c.json({ error: 'the ritual has not risen' }, 409);
    if ('busy' in s) return c.json({ error: 'Death is already attacking', id: s.id }, 409);
    return c.json({ id: s.id }, 202);
  });

  app.get('/api/attacks/:id/events', (c) => streamLog(c, attacks, c.req.param('id'), attackOver, 'no such attack'));

  // R4: the engine's own frames of the app under attack, drawn as the body in the attack scene.
  app.get('/api/attacks/:id/frames/:ghostId/:seq', async (c) => {
    const jpeg = await attacks.frame(c.req.param('id'), c.req.param('ghostId'), Number(c.req.param('seq')));
    if (!jpeg) return c.json({ error: 'no such frame' }, 404);
    return c.body(new Uint8Array(jpeg), 200, { 'content-type': 'image/jpeg', 'cache-control': 'no-store' });
  });

  return app;
}

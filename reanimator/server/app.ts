import { Hono } from 'hono';
import { attackOver, type HealTarget } from '../shared/attack.js';
import { spellOver } from '../shared/grimoire.js';
import type { RitualEvent } from '../shared/ritual.js';
import type { Attacks } from './attack.js';
import type { Grimoire } from './grimoire.js';
import { parseGraveUrl } from './grave.js';
import { loopbackGuard } from './guard.js';
import type { Rituals } from './ritual.js';
import { streamLog } from './sse.js';

export type RitualsApi = Pick<Rituals, 'start' | 'events' | 'subscribe'>;
export type AttacksApi = Pick<Attacks, 'start' | 'events' | 'subscribe' | 'frame'>;
export type GrimoireApi = Pick<Grimoire, 'start' | 'events' | 'subscribe' | 'stop'>;

const MAX_SPELL = 20_000;

const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v !== '';
const isHealTarget = (v: unknown): v is HealTarget =>
  typeof v === 'object' && v !== null && nonEmpty((v as HealTarget).criterion) && nonEmpty((v as HealTarget).persona);

const terminal = (e: RitualEvent) => e.type === 'risen' || e.type === 'failed';

// The backend's routes. Every /api route is loopback-only (KI-R12). R2 adds the ritual: POST starts
// one, and its events stream as resumable SSE (sse.ts). R3 adds Death's attack on a risen ritual,
// R7 the grimoire's spells (Kiro on the revived body), never both at once.
export function createApp(o: { rituals?: RitualsApi; attacks?: AttacksApi; grimoire?: GrimoireApi } = {}): Hono {
  const app = new Hono();
  app.use('/api/*', loopbackGuard());
  app.get('/api/health', (c) => c.json({ ok: true, name: 'reanimator' }));

  const rituals = o.rituals;
  if (!rituals) return app;

  // R9: {repo} names a grave on GitHub; no repo raises our own corpse.
  app.post('/api/rituals', async (c) => {
    const body: unknown = await c.req.json().catch(() => ({}));
    const repo = typeof body === 'object' && body !== null ? (body as { repo?: unknown }).repo : undefined;
    let req = {};
    if (repo !== undefined) {
      const grave = typeof repo === 'string' ? parseGraveUrl(repo) : null;
      if (!grave) return c.json({ error: 'repo must be https://github.com/<owner>/<repo>' }, 400);
      req = { repo: grave.url };
    }
    const s = rituals.start(req);
    if ('busy' in s) return c.json({ error: 'a ritual is already running', id: s.id }, 409);
    return c.json({ id: s.id }, 202);
  });

  app.get('/api/rituals/:id/events', (c) => streamLog(c, rituals, c.req.param('id'), terminal, 'no such ritual'));

  const attacks = o.attacks;
  if (!attacks) return app;

  app.post('/api/rituals/:id/attack', async (c) => {
    const body: unknown = await c.req.json().catch(() => ({}));
    const { only, heal } = typeof body === 'object' && body !== null ? (body as { only?: unknown; heal?: unknown }) : {};
    if (only !== undefined && !(Array.isArray(only) && only.every((x) => typeof x === 'string' && x !== ''))) {
      return c.json({ error: 'only must be a list of criterion ids' }, 400);
    }
    // R5: a heal re-runs one wound (D-R20); Attacks itself checks that the wound is open.
    if (heal !== undefined && !isHealTarget(heal)) return c.json({ error: 'heal must be {criterion, persona}' }, 400);
    const s = attacks.start(c.req.param('id'), { only: only as string[] | undefined, heal: heal && { criterion: heal.criterion, persona: heal.persona } });
    if ('notRisen' in s) return c.json({ error: 'the ritual has not risen' }, 409);
    if ('noChart' in s) return c.json({ error: 'this grave has no chart: Death needs one to attack' }, 409);
    if ('casting' in s) return c.json({ error: 'Kiro is still casting; wait for the seal' }, 409);
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

  const grimoire = o.grimoire;
  if (!grimoire) return app;

  // R7: a spell is Kiro's next turn on the body; `heal` names the wound it was cast for.
  app.post('/api/rituals/:id/spells', async (c) => {
    const body: unknown = await c.req.json().catch(() => ({}));
    const { text, heal } = typeof body === 'object' && body !== null ? (body as { text?: unknown; heal?: unknown }) : {};
    if (typeof text !== 'string' || text.trim() === '' || text.length > MAX_SPELL) return c.json({ error: `text must be 1–${MAX_SPELL} characters` }, 400);
    if (heal !== undefined && !isHealTarget(heal)) return c.json({ error: 'heal must be {criterion, persona}' }, 400);
    const s = grimoire.start(c.req.param('id'), { text, heal: heal && { criterion: heal.criterion, persona: heal.persona } });
    if ('notRisen' in s) return c.json({ error: 'the ritual has not risen' }, 409);
    if ('attacking' in s) return c.json({ error: 'Death is attacking; wait for him' }, 409);
    if ('busy' in s) return c.json({ error: 'Kiro is already casting', id: s.id }, 409);
    return c.json({ id: s.id }, 202);
  });

  app.get('/api/spells/:id/events', (c) => streamLog(c, grimoire, c.req.param('id'), spellOver, 'no such spell'));

  app.post('/api/spells/:id/stop', async (c) => {
    await grimoire.stop(c.req.param('id'));
    return c.json({}, 202);
  });

  return app;
}

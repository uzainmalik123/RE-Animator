import { describe, expect, it, vi } from 'vitest';
import type { SpellEvent } from '../shared/grimoire.js';
import { Grimoire } from './grimoire.js';
import type { runKiro } from './kiro.js';

type Kiro = typeof runKiro;

const healTurn: Kiro = async (o) => {
  o.onEvent({ type: 'quill', text: 'Fixed.' });
  return { ok: true, stopReason: 'end_turn' };
};

// Resolves when its signal aborts, like a kiro-cli turn that never ends on its own.
const hangingTurn: Kiro = (o) =>
  new Promise((resolve) => {
    o.onEvent({ type: 'quill', text: 'thinking' });
    o.signal?.addEventListener('abort', () => resolve({ ok: false, error: 'stopped' }), { once: true });
  });

function make(kiro: Kiro, o: { risen?: boolean; attacking?: boolean } = {}) {
  const fn = vi.fn<Kiro>(kiro);
  const rituals = { body: (id: string) => (o.risen !== false && (id === 'r1' || id === 'r2') ? { origin: null, revivedDir: `/bodies/${id}`, fixture: {} as never } : null) };
  const g = new Grimoire({ rituals, attacking: () => o.attacking === true, cli: '/kiro', env: { PATH: '/b', HOME: '/h', ANTHROPIC_API_KEY: 'k' }, kiro: fn });
  return { g, kiro: fn };
}

async function settle(g: Grimoire, id: string): Promise<SpellEvent[]> {
  for (let i = 0; i < 200; i++) {
    const ev = g.events(id);
    if (ev?.done) return ev.log;
    await new Promise((res) => setTimeout(res, 5));
  }
  throw new Error('spell never ended');
}

const cast = (g: Grimoire, ritual = 'r1', text = 'fix it', heal?: { criterion: string; persona: string }) => {
  const s = g.start(ritual, { text, heal });
  if (!('id' in s) || 'busy' in s) throw new Error(JSON.stringify(s));
  return s.id;
};

describe('Grimoire', () => {
  it('casts a spell on the risen body and seals it', async () => {
    const { g, kiro } = make(healTurn);
    const log = await settle(g, cast(g, 'r1', 'fix it', { criterion: '1.2', persona: 'wraith' }));
    expect(log).toEqual([
      { type: 'cast', text: 'fix it', heal: { criterion: '1.2', persona: 'wraith' } },
      { type: 'quill', text: 'Fixed.' },
      { type: 'sealed', stopReason: 'end_turn' },
    ]);
    const call = kiro.mock.calls[0]![0];
    expect(call.cwd).toBe('/bodies/r1');
    expect(call.cli).toBe('/kiro');
    expect(call.text).toBe('fix it');
    expect(call.resume).toBe(false);
    expect(call.env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(call.env.HOME).toBe('/h');
  });

  it('resumes the conversation on later spells of the same ritual, not on a new one', async () => {
    const { g, kiro } = make(healTurn);
    await settle(g, cast(g, 'r1'));
    await settle(g, cast(g, 'r1'));
    await settle(g, cast(g, 'r2'));
    expect(kiro.mock.calls.map((c) => c[0].resume)).toEqual([false, true, false]);
  });

  it('refuses a body that has not risen, a Death mid-attack, and a second spell', async () => {
    expect(make(healTurn, { risen: false }).g.start('r1', { text: 'x' })).toEqual({ notRisen: true });
    const dead = make(healTurn, { attacking: true });
    expect(dead.g.start('r1', { text: 'x' })).toEqual({ attacking: true });
    expect(dead.kiro).not.toHaveBeenCalled();
    const { g } = make(hangingTurn);
    const id = cast(g);
    expect(g.busy()).toBe(true);
    expect(g.start('r1', { text: 'y' })).toEqual({ busy: true, id });
    await g.stop();
  });

  it('writes a failed turn down as a failed spell', async () => {
    const { g } = make(async () => ({ ok: false, error: 'error: not logged in' }));
    expect((await settle(g, cast(g))).at(-1)).toEqual({ type: 'failed', reason: 'error: not logged in' });
  });

  it('breaks off a spell that hangs', async () => {
    const { g } = make(hangingTurn);
    const id = cast(g);
    await g.stop('someone-else');
    expect(g.busy()).toBe(true);
    await g.stop(id);
    expect(g.busy()).toBe(false);
    expect((await settle(g, id)).at(-1)).toEqual({ type: 'failed', reason: 'stopped: the spell was broken off' });
  });

  it('writes a thrown turn down as a failed spell', async () => {
    const { g } = make(async () => {
      throw new Error('boom');
    });
    expect((await settle(g, cast(g))).at(-1)).toEqual({ type: 'failed', reason: 'boom' });
  });
});

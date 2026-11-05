import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { attackOver, type AttackEvent } from '../shared/attack.js';
import { parseLines } from '../shared/recording.js';
import type { RitualEvent } from '../shared/ritual.js';
import type { AttacksApi, GrimoireApi, RitualsApi } from './app.js';
import { EventLog } from './event-log.js';
import { Recorder, recordApis } from './recorder.js';

// One log per id, shaped like Rituals/Attacks/Grimoire's events + subscribe.
function source<E>(isTerminal: (e: E) => boolean) {
  const logs = new Map<string, EventLog<E>>();
  const log = (id: string) => logs.get(id) ?? logs.set(id, new EventLog<E>(isTerminal)).get(id)!;
  return {
    log,
    events: (id: string, after = -1) => logs.get(id)?.events(after) ?? null,
    subscribe: (id: string, fn: (e: E, i: number) => void) => log(id).subscribe(fn),
  };
}

const started: RitualEvent = { type: 'started', repo: 'guestbook-2016', diedIn: 2016 };
const risen: RitualEvent = { type: 'risen', origin: 'http://127.0.0.1:5000/' };

async function setup(o: { capBytes?: number } = {}) {
  const dir = join(await mkdtemp(join(tmpdir(), 'r11-rec-')), 'recording');
  let clock = 1000;
  const warnings: string[] = [];
  const rec = new Recorder({ dir, home: '/home/necro', now: () => clock, capBytes: o.capBytes, warn: (m) => warnings.push(m) });
  const lines = () => parseLines(readFileSync(join(dir, 'events.ndjson'), 'utf8'));
  return { dir, rec, lines, warnings, tick: (ms: number) => (clock += ms) };
}

describe('Recorder (R11)', () => {
  it('writes a manifest and records events from before and after watch, once, with their times', async () => {
    const { dir, rec, lines, tick } = await setup();
    expect(JSON.parse(readFileSync(join(dir, 'recording.json'), 'utf8'))).toEqual({ format: 'reanimator-recording', version: 1, recordedAt: new Date(1000).toISOString() });
    const src = source<RitualEvent>((e) => e.type === 'risen');
    src.log('r1').push(started);
    tick(50);
    rec.watch('ritual', 'r1', src);
    rec.watch('ritual', 'r1', src);
    tick(100);
    src.log('r1').push(risen);
    expect(lines()).toEqual([
      { t: 50, stream: 'ritual', id: 'r1', event: started },
      { t: 150, stream: 'ritual', id: 'r1', event: risen },
    ]);
  });

  it('replaces the home directory with ~', async () => {
    const { rec, lines } = await setup();
    const src = source<AttackEvent>(attackOver);
    rec.watch('attack', 'a1', src);
    src.log('a1').push({ type: 'failed', reason: 'cannot read /home/necro/body/x' });
    expect(lines()[0]!.event).toEqual({ type: 'failed', reason: 'cannot read ~/body/x' });
  });

  it('refuses a directory that already holds a recording', async () => {
    const { dir } = await setup();
    expect(() => new Recorder({ dir, home: '/home/necro' })).toThrow(/already exists/);
  });

  it('stops keeping frames past the cap, and says so once', async () => {
    const { dir, rec, warnings } = await setup({ capBytes: 10 });
    rec.frame('a1', 'g1', 0, Buffer.alloc(6));
    rec.frame('a1', 'g1', 1, Buffer.alloc(6));
    rec.frame('a1', 'g1', 2, Buffer.alloc(6));
    expect(existsSync(join(dir, 'frames/a1/g1/0.jpg'))).toBe(true);
    expect(existsSync(join(dir, 'frames/a1/g1/1.jpg'))).toBe(false);
    expect(warnings).toHaveLength(1);
  });
});

describe('recordApis (R11)', () => {
  function apis(frame: (id: string, g: string, s: number) => Promise<Buffer | null>) {
    const rituals = source<RitualEvent>((e) => e.type === 'risen');
    const attacks = source<AttackEvent>(attackOver);
    const spells = source<never>(() => false);
    const api = {
      rituals: { ...rituals, start: () => ({ id: 'r1' }) } as unknown as RitualsApi,
      attacks: { ...attacks, start: () => ({ id: 'a1' }), frame } as unknown as AttacksApi,
      grimoire: { ...spells, start: () => ({ notRisen: true }), stop: async () => {} } as unknown as GrimoireApi,
    };
    return { api, rituals, attacks };
  }
  const frameEvent: AttackEvent = { type: 'engine', event: { type: 'frame', ghostId: 'g1', seq: 3 } };
  const settle = () => new Promise((r) => setTimeout(r, 10));

  it('records whatever a started ritual and attack stream, and the frames Death showed', async () => {
    const { dir, rec, lines } = await setup();
    const { api, rituals, attacks } = apis(async () => Buffer.from('jpg'));
    const wrapped = recordApis(api, rec);
    expect(wrapped.rituals.start()).toEqual({ id: 'r1' });
    rituals.log('r1').push(started);
    wrapped.attacks.start('r1', {});
    attacks.log('a1').push(frameEvent);
    await settle();
    expect(lines().map((l) => [l.stream, l.id])).toEqual([['ritual', 'r1'], ['attack', 'a1']]);
    expect(readFileSync(join(dir, 'frames/a1/g1/3.jpg'), 'utf8')).toBe('jpg');
    expect(wrapped.grimoire.start('r1', { text: 'x' })).toEqual({ notRisen: true });
  });

  it('skips a frame the engine no longer has', async () => {
    const { dir, rec } = await setup();
    const { api, attacks } = apis(async () => null);
    recordApis(api, rec).attacks.start('r1', {});
    attacks.log('a1').push(frameEvent);
    await settle();
    expect(existsSync(join(dir, 'frames'))).toBe(false);
  });
});

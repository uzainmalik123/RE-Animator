import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { AttackEvent, Counts, Wound } from '../shared/attack.js';
import { Attacks } from './attack.js';
import { chartDir } from './chart.js';
import type { Rituals } from './ritual.js';
import type { runEngine } from './engine.js';
import { PRACTICE_CORPSE, loadFixture } from './fixtures.js';

const COUNTS: Counts = { haunted: 1, flaky: 0, inconclusive: 0, clean: 5, notApplicable: 0, notRun: 0 };
const WOUND: Wound = { criterion: '1.2', text: 'record only one entry', persona: 'wraith', reason: 'two entries', steps: [], expected: [], failing: [], artifacts: [], carried: false };

type Engine = typeof runEngine;

async function make(engine: Engine, o: { risen?: boolean; read?: boolean; reraise?: Rituals['reraise']; casting?: () => boolean; edited?: (ritualId: string) => boolean; chartless?: boolean } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'r3-attacks-'));
  const loaded = await loadFixture(PRACTICE_CORPSE);
  const fixture = o.chartless ? { ...loaded, chartDir: null } : loaded;
  let origin = 'http://127.0.0.1:5001';
  const reraise = vi.fn<Rituals['reraise']>(o.reraise ?? (async (_id, onVital) => {
    for (const vital of ['install', 'build', 'serve', 'render'] as const) onVital({ vital, ok: true, detail: '', ms: 1 });
    origin = 'http://127.0.0.1:5002';
    return { origin };
  }));
  const rituals = { body: (id: string) => (o.risen !== false && id === 'r1' ? { origin, revivedDir: root, fixture } : null), reraise };
  const read = vi.fn(async () => ({ counts: COUNTS, wounds: [WOUND], pairs: {} }));
  const a = new Attacks({ rituals, homeRoot: join(root, 'home'), cli: '/cli.js', env: { PATH: '/bin', ANTHROPIC_API_KEY: 'k', DOPPLER_TOKEN: 'd' }, engine, casting: o.casting, edited: o.edited, ...(o.read === false ? {} : { read }) });
  return { a, read, root, reraise };
}

async function settle(a: Attacks, id: string): Promise<AttackEvent[]> {
  for (let i = 0; i < 200; i++) {
    const ev = a.events(id);
    if (ev?.done) return ev.log;
    await new Promise((res) => setTimeout(res, 5));
  }
  throw new Error('attack never finished');
}

const begin = (a: Attacks, only?: string[], heal?: { criterion: string; persona: string }) => {
  const s = a.start('r1', { only, heal });
  if (!('id' in s) || 'busy' in s) throw new Error(JSON.stringify(s));
  return s.id;
};

describe('Attacks', () => {
  it('summons the engine at the risen origin and reports its wounds', async () => {
    const engine = vi.fn<Engine>(async (o) => {
      o.onEvent({ type: 'run.started', criteria: ['1.2'], personas: ['wraith'], reps: 3 });
      return { code: 1, error: null, runId: 'run-7', reportPath: join(o.specDir, 'haunting-report.json') };
    });
    const { a, read } = await make(engine);
    const log = await settle(a, begin(a, ['1.2']));
    expect(log).toEqual([
      { type: 'summoned', origin: 'http://127.0.0.1:5001', only: ['1.2'], heal: null, body: expect.any(String), wounds: [], healed: [] },
      { type: 'engine', event: { type: 'run.started', criteria: ['1.2'], personas: ['wraith'], reps: 3 } },
      { type: 'finished', counts: COUNTS, wounds: [WOUND], healed: [], heal: null },
    ]);
    const call = engine.mock.calls[0]![0];
    expect(call.cli).toBe('/cli.js');
    expect(call.only).toEqual(['1.2']);
    expect(call.env).toEqual({ PATH: '/bin', ANTHROPIC_API_KEY: 'k', NO_COLOR: '1' });
    expect(read).toHaveBeenCalledWith(join(call.specDir, 'haunting-report.json'), 'run-7');
  });

  it('refuses a second attack while one runs', async () => {
    let finish!: () => void;
    const engine = vi.fn<Engine>(async (o) => {
      await new Promise<void>((r) => (finish = r));
      return { code: 0, error: null, runId: 'run-1', reportPath: o.specDir };
    });
    const { a } = await make(engine);
    expect(a.busy()).toBe(false);
    const id = begin(a);
    expect(a.busy()).toBe(true);
    expect(a.start('r1')).toEqual({ busy: true, id });
    await vi.waitFor(() => expect(engine).toHaveBeenCalled());
    finish();
    await settle(a, id);
  });

  it('refuses to attack while Kiro is casting on the body (R7)', async () => {
    const engine = vi.fn<Engine>();
    const { a } = await make(engine, { casting: () => true });
    expect(a.start('r1')).toEqual({ casting: true });
    expect(engine).not.toHaveBeenCalled();
  });

  it('refuses a grave with no chart before anything runs (R9)', async () => {
    const engine = vi.fn<Engine>();
    const { a, reraise } = await make(engine, { chartless: true });
    expect(a.start('r1')).toEqual({ noChart: true });
    expect(a.busy()).toBe(false);
    expect(engine).not.toHaveBeenCalled();
    expect(reraise).not.toHaveBeenCalled();
  });

  it('refuses a ritual that has not risen', async () => {
    const { a } = await make(vi.fn<Engine>(), { risen: false });
    expect(a.start('r1')).toEqual({ notRisen: true });
  });

  it('fails with the engine\'s error line', async () => {
    const { a } = await make(vi.fn<Engine>(async (o) => ({ code: 2, error: 'boom', runId: null, reportPath: o.specDir })));
    const log = await settle(a, begin(a));
    expect(log.at(-1)).toEqual({ type: 'failed', reason: 'boom' });
  });

  it('never reads a report when the engine crashed before starting a run', async () => {
    const { a, read } = await make(vi.fn<Engine>(async (o) => ({ code: 1, error: "Cannot find package 'tsx'", runId: null, reportPath: o.specDir })));
    const log = await settle(a, begin(a));
    expect(log.at(-1)).toEqual({ type: 'failed', reason: "the engine wrote no readable report: Cannot find package 'tsx'" });
    expect(read).not.toHaveBeenCalled();
  });

  it('stop() aborts the engine and ends the attack as stopped', async () => {
    let seen: AbortSignal | undefined;
    const engine = vi.fn<Engine>(async (o) => {
      seen = o.signal;
      await new Promise((r) => o.signal!.addEventListener('abort', r, { once: true }));
      return { code: null, error: 'stopped', runId: null, reportPath: o.specDir };
    });
    const { a } = await make(engine);
    const id = begin(a);
    await vi.waitFor(() => expect(engine).toHaveBeenCalled());
    await a.stop();
    expect(seen!.aborted).toBe(true);
    const log = a.events(id)!.log;
    expect(log.at(-1)).toMatchObject({ type: 'failed' });
    expect((log.at(-1) as { reason: string }).reason).toMatch(/^stopped/);
  });

  it('serves a frame of the current run, and nothing outside it', async () => {
    const runDir = await mkdtemp(join(tmpdir(), 'r4-run-'));
    await mkdir(join(runDir, 'frames', 'g1'), { recursive: true });
    await writeFile(join(runDir, 'frames', 'g1', '00002.jpg'), 'jpeg-bytes');
    await writeFile(join(runDir, 'secret.jpg'), 'nope');
    const engine = vi.fn<Engine>(async (o) => {
      o.onRun?.(runDir);
      return { code: 1, error: null, runId: 'run-1', reportPath: o.specDir };
    });
    const { a } = await make(engine);
    const id = begin(a);
    await settle(a, id);
    expect((await a.frame(id, 'g1', 2))?.toString()).toBe('jpeg-bytes');
    for (const [ghost, seq] of [['..', 2], ['g1/..', 2], ['.', 2], ['g1', -1], ['g1', 1.5], ['g1', 3], ['g1', Number.NaN]] as const) {
      expect(await a.frame(id, ghost, seq)).toBeNull();
    }
    expect(await a.frame('other', 'g1', 2)).toBeNull();
  });
});

describe('Attacks: healing (R5)', () => {
  const HEAL = { criterion: '1.2', persona: 'wraith' };
  const pair = (persona: string, verdict: string, extra: object = {}) => ({ persona, verdict, reason: `${persona} ${verdict}`, expected: [], failing: [], artifacts: [], ...extra });
  const reportOf = (runId: string, pairs: object[]) => JSON.stringify({ version: 1, runId, counts: COUNTS, criteria: [{ id: '1.2', text: 'record only one entry', pairs }] });
  const writeReport = async (root: string, body: string) => {
    await mkdir(chartDir(root), { recursive: true });
    await writeFile(join(chartDir(root), 'haunting-report.json'), body);
  };
  // An engine that writes `next` as its report under run `runId`.
  const engineWriting = (runId: string, pairs: object[]) =>
    vi.fn<Engine>(async (o) => {
      await writeFile(join(o.specDir, 'haunting-report.json'), reportOf(runId, pairs));
      return { code: 0, error: null, runId, reportPath: join(o.specDir, 'haunting-report.json') };
    });

  it('raises the body again on the first attack if Kiro edited it (R7)', async () => {
    const { a, reraise } = await make(engineWriting('run-1', []), { read: false, edited: (id) => id === 'r1' });
    const first = await settle(a, begin(a));
    expect(reraise).toHaveBeenCalledTimes(1);
    expect(first).toContainEqual({ type: 'reraised', origin: 'http://127.0.0.1:5002' });
  });

  it('raises the body again before every attack but the first', async () => {
    const { a, reraise } = await make(engineWriting('run-1', []), { read: false });
    const first = await settle(a, begin(a));
    expect(reraise).not.toHaveBeenCalled();
    expect(first.some((e) => e.type === 'pulse')).toBe(false);
    const second = await settle(a, begin(a));
    expect(reraise).toHaveBeenCalledTimes(1);
    expect(second.filter((e) => e.type === 'pulse')).toHaveLength(4);
    expect(second).toContainEqual({ type: 'reraised', origin: 'http://127.0.0.1:5002' });
  });

  it('refuses to heal a wound that is not open, without running the engine', async () => {
    const engine = engineWriting('run-2', []);
    const { a } = await make(engine, { read: false });
    const log = await settle(a, begin(a, undefined, HEAL));
    expect(log.at(-1)).toEqual({ type: 'failed', reason: 'that wound is not open' });
    expect(engine).not.toHaveBeenCalled();
  });

  it('closes a wound when its pair runs clean', async () => {
    const engine = engineWriting('run-2', [pair('wraith', 'clean')]);
    const { a, root } = await make(engine, { read: false });
    await writeReport(root, reportOf('run-1', [pair('wraith', 'haunted')]));
    const log = await settle(a, begin(a, undefined, HEAL));
    expect(log[0]).toMatchObject({ type: 'summoned', heal: HEAL, body: root, wounds: [{ criterion: '1.2', persona: 'wraith' }] });
    expect(engine.mock.calls[0]![0]).toMatchObject({ only: ['1.2'], personas: ['wraith'] });
    const fin = log.at(-1);
    expect(fin).toMatchObject({ type: 'finished', wounds: [], healed: [{ criterion: '1.2', persona: 'wraith' }], heal: { ...HEAL, verdict: 'clean' } });
  });

  it('keeps the wound open when its pair was carried, not run', async () => {
    const { a, root } = await make(engineWriting('run-2', [pair('wraith', 'haunted', { carriedFrom: 'run-1' })]), { read: false });
    await writeReport(root, reportOf('run-1', [pair('wraith', 'haunted')]));
    const fin = (await settle(a, begin(a, undefined, HEAL))).at(-1);
    expect(fin).toMatchObject({ type: 'finished', healed: [], heal: { ...HEAL, verdict: 'notRun' } });
  });

  it('keeps a wound a heal left unproven (flaky) open, and lets it be dared again', async () => {
    let next = engineWriting('run-2', [pair('wraith', 'flaky')]);
    const { a, root } = await make(vi.fn<Engine>((o) => next(o)), { read: false });
    await writeReport(root, reportOf('run-1', [pair('wraith', 'haunted')]));
    const fin = (await settle(a, begin(a, undefined, HEAL))).at(-1);
    expect(fin).toMatchObject({ type: 'finished', healed: [], wounds: [{ criterion: '1.2', persona: 'wraith' }], heal: { ...HEAL, verdict: 'flaky' } });
    next = engineWriting('run-3', [pair('wraith', 'clean')]);
    const log = await settle(a, begin(a, undefined, HEAL));
    expect(log[0]).toMatchObject({ type: 'summoned', wounds: [{ persona: 'wraith' }] });
    expect(log.at(-1)).toMatchObject({ type: 'finished', wounds: [], healed: [{ persona: 'wraith' }], heal: { ...HEAL, verdict: 'clean' } });
  });

  it('fails when the heal broke the body', async () => {
    const engine = engineWriting('run-2', []);
    const { a, root } = await make(engine, { read: false, reraise: async () => ({ failed: 'build: boom' }) });
    await settle(a, begin(a));
    await writeReport(root, reportOf('run-1', [pair('wraith', 'haunted')]));
    const log = await settle(a, begin(a, undefined, HEAL));
    expect(log.at(-1)).toEqual({ type: 'failed', reason: 'the heal broke the body: build: boom' });
    expect(engine).toHaveBeenCalledTimes(1);
  });

  it('reopens a healed wound that a later attack breaks again', async () => {
    let next = engineWriting('run-2', [pair('wraith', 'clean')]);
    const { a, root } = await make(vi.fn<Engine>((o) => next(o)), { read: false });
    await writeReport(root, reportOf('run-1', [pair('wraith', 'haunted')]));
    expect((await settle(a, begin(a, undefined, HEAL))).at(-1)).toMatchObject({ healed: [{ persona: 'wraith' }] });
    next = engineWriting('run-3', [pair('wraith', 'haunted')]);
    const fin = (await settle(a, begin(a))).at(-1);
    expect(fin).toMatchObject({ type: 'finished', healed: [], wounds: [{ persona: 'wraith' }], heal: null });
  });

  it('stop() during the re-raise ends the attack as stopped', async () => {
    const { a } = await make(engineWriting('run-1', []), {
      read: false,
      reraise: (_id, _on, signal) => new Promise((res) => signal!.addEventListener('abort', () => res({ failed: 'install: stopped: the ritual was stopped' }), { once: true })),
    });
    await settle(a, begin(a));
    const id = begin(a);
    await vi.waitFor(() => expect(a.events(id)!.log.length).toBeGreaterThan(0));
    await a.stop();
    expect(a.events(id)!.log.at(-1)).toEqual({ type: 'failed', reason: 'stopped: a new ritual began' });
  });
});

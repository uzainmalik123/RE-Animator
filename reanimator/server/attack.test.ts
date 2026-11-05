import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { AttackEvent, Counts, Wound } from '../shared/attack.js';
import { Attacks } from './attack.js';
import type { runEngine } from './engine.js';
import { PRACTICE_CORPSE, loadFixture } from './fixtures.js';

const COUNTS: Counts = { haunted: 1, flaky: 0, inconclusive: 0, clean: 5, notApplicable: 0, notRun: 0 };
const WOUND: Wound = { criterion: '1.2', text: 'record only one entry', persona: 'wraith', reason: 'two entries', steps: [], expected: [], failing: [], artifacts: [], carried: false };

type Engine = typeof runEngine;

async function make(engine: Engine, o: { risen?: boolean } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'r3-attacks-'));
  const fixture = await loadFixture(PRACTICE_CORPSE);
  const rituals = { risen: (id: string) => (o.risen !== false && id === 'r1' ? { origin: 'http://127.0.0.1:5001', revivedDir: root, fixture } : null) };
  const read = vi.fn(async () => ({ counts: COUNTS, wounds: [WOUND] }));
  return { a: new Attacks({ rituals, homeRoot: join(root, 'home'), cli: '/cli.js', env: { PATH: '/bin', ANTHROPIC_API_KEY: 'k', DOPPLER_TOKEN: 'd' }, engine, read }), read };
}

async function settle(a: Attacks, id: string): Promise<AttackEvent[]> {
  for (let i = 0; i < 200; i++) {
    const ev = a.events(id);
    if (ev?.done) return ev.log;
    await new Promise((res) => setTimeout(res, 5));
  }
  throw new Error('attack never finished');
}

const begin = (a: Attacks, only?: string[]) => {
  const s = a.start('r1', only);
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
    const id = begin(a);
    expect(a.start('r1')).toEqual({ busy: true, id });
    await vi.waitFor(() => expect(engine).toHaveBeenCalled());
    finish();
    await settle(a, id);
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

import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { EngineEvent } from '../shared/attack.js';
import { runEngine, toEngineEvent } from './engine.js';

const STUB = fileURLToPath(new URL('./test-engine.mjs', import.meta.url));

async function dirs() {
  const root = await mkdtemp(join(tmpdir(), 'r3-engine-'));
  const home = join(root, 'home');
  const specDir = join(root, 'spec');
  await mkdir(home);
  await mkdir(specDir);
  return { home, specDir, configPath: join(home, 'poltergeist.config.json') };
}

describe('runEngine', () => {
  it('forwards the engine\'s events, whole lines only, and points at the report', async () => {
    const d = await dirs();
    const seen: EngineEvent[] = [];
    const r = await runEngine({ cli: STUB, ...d, env: { PATH: process.env.PATH }, onEvent: (e) => seen.push(e), pollMs: 50 });
    expect(r).toEqual({ code: 1, error: null, runId: 'stub-1', reportPath: join(d.specDir, 'haunting-report.json') });
    expect(seen.filter((e) => e.type !== 'frame')).toEqual([
      { type: 'run.started', criteria: ['1.2'], personas: ['wraith'], reps: 3 },
      { type: 'plan.compiled', criterion: '1.2', persona: 'wraith', status: 'compiled', cached: false },
      { type: 'ghost.spawned', ghostId: 'g1', criterion: '1.2', persona: 'wraith', rep: 1 },
      { type: 'ghost.step', ghostId: 'g1', x: 3, y: 4 },
    ]);
    // One frame mark a second per ghost: seq 1 (500 ms after seq 0) is dropped.
    expect(seen.filter((e) => e.type === 'frame')).toEqual([
      { type: 'frame', ghostId: 'g1', seq: 0 },
      { type: 'frame', ghostId: 'g1', seq: 2 },
    ]);
  });

  it('calls onRun with the run dir', async () => {
    const d = await dirs();
    const runs: string[] = [];
    await runEngine({ cli: STUB, ...d, env: { PATH: process.env.PATH }, onEvent: () => {}, onRun: (dir) => runs.push(dir), pollMs: 50 });
    expect(runs).toEqual([join(d.home, '.poltergeist', 'runs', 'stub-1')]);
  });

  it('reports the CLI\'s error line when it exits 2', async () => {
    const d = await dirs();
    const r = await runEngine({ cli: STUB, ...d, env: { PATH: process.env.PATH, STUB_CODE: '2' }, onEvent: () => {} });
    expect(r.code).toBe(2);
    expect(r.error).toBe('The LLM client could not be set up: no key');
  });

  it('treats an exit 1 with no run as a crash, keeping its last words', async () => {
    const d = await dirs();
    const r = await runEngine({ cli: STUB, ...d, env: { PATH: process.env.PATH, STUB_CRASH: '1' }, onEvent: () => {} });
    expect(r.code).toBe(1);
    expect(r.runId).toBeNull();
    expect(r.error).toBe("Error: Cannot find package 'tsx'");
  });

  it('stops the engine when its signal aborts', async () => {
    const d = await dirs();
    const ac = new AbortController();
    setTimeout(() => ac.abort(), 500);
    const t0 = Date.now();
    const r = await runEngine({ cli: STUB, ...d, env: { PATH: process.env.PATH, STUB_HANG: '1' }, onEvent: () => {}, signal: ac.signal });
    expect(r.code).toBeNull();
    expect(Date.now() - t0).toBeLessThan(4000);
  });

  it('passes --only through', async () => {
    const d = await dirs();
    const r = await runEngine({ cli: STUB, ...d, env: { PATH: process.env.PATH }, only: ['1.2', '2.1'], onEvent: () => {} });
    expect(r.code).toBe(1);
    const argv = JSON.parse(await readFile(join(d.home, 'argv.json'), 'utf8')) as string[];
    expect(argv).toEqual(['summon', '--spec', d.specDir, '--config', d.configPath, '--only', '1.2,2.1']);
  });

  it('passes --personas through after --only', async () => {
    const d = await dirs();
    await runEngine({ cli: STUB, ...d, env: { PATH: process.env.PATH }, only: ['1.2'], personas: ['wraith'], onEvent: () => {} });
    const argv = JSON.parse(await readFile(join(d.home, 'argv.json'), 'utf8')) as string[];
    expect(argv.slice(-4)).toEqual(['--only', '1.2', '--personas', 'wraith']);
  });
});

describe('toEngineEvent', () => {
  it('keeps a step without numeric x/y, but with no position', () => {
    expect(toEngineEvent({ type: 'ghost.step', ghostId: 'g1', x: '3', y: 4 })).toEqual({ type: 'ghost.step', ghostId: 'g1' });
  });

  it('drops a ghost event with no ghost id', () => {
    expect(toEngineEvent({ type: 'ghost.spawned', criterion: '1.2', persona: 'wraith', rep: 1 })).toBeNull();
    expect(toEngineEvent({ type: 'ghost.step', ghost: 'g' })).toBeNull();
  });

  it('keeps a finished rep', () => {
    expect(toEngineEvent({ type: 'rep.finished', rep: 2, outcomes: {} })).toEqual({ type: 'rep.finished', rep: 2 });
  });
});

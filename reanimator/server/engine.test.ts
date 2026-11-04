import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { EngineEvent } from '../shared/attack.js';
import { runEngine } from './engine.js';

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
    expect(seen).toEqual([
      { type: 'run.started', criteria: ['1.2'], personas: ['wraith'], reps: 3 },
      { type: 'plan.compiled', criterion: '1.2', persona: 'wraith', status: 'compiled', cached: false },
    ]);
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
});

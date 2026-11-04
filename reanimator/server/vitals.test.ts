import { describe, expect, it, vi } from 'vitest';
import type { RitualEvent } from '../shared/ritual.js';
import type { CommandResult, RunningApp } from './exec.js';
import type { Fixture } from './fixtures.js';
import { runVitals, type VitalDeps } from './vitals.js';

const fixture: Fixture = {
  name: 'guestbook-2016',
  diedIn: 2016,
  licence: 'MIT',
  serve: ['node', 'server.js'],
  dir: '/f',
  corpseDir: '/f/corpse',
  remedyDir: '/f/remedy',
};
const done = (over: Partial<CommandResult> = {}): CommandResult => ({ code: 0, output: '', timedOut: false, ms: 1, ...over });

function fakeDeps(over: Partial<VitalDeps> = {}) {
  const app: RunningApp = { origin: 'http://127.0.0.1:5001', port: 5001, exited: new Promise(() => {}), output: () => '', stop: vi.fn(async () => {}) };
  const deps: VitalDeps = {
    runCommand: vi.fn(async () => done()),
    startApp: vi.fn(() => app),
    freePort: vi.fn(async () => 5001),
    waitForHttp: vi.fn(async () => ({ ok: true, detail: 'HTTP 200' })),
    renderCheck: vi.fn(async () => ({ ok: true, detail: 'rendered' })),
    ...over,
  };
  return { deps, app };
}

async function run(deps: VitalDeps) {
  const events: RitualEvent[] = [];
  const r = await runVitals('revived', '/work', fixture, deps, (e) => events.push(e));
  return { r, events };
}

describe('runVitals', () => {
  it('runs all four in order and leaves the app running', async () => {
    const { deps, app } = fakeDeps();
    const { r, events } = await run(deps);
    expect(events.map((e) => (e.type === 'vital' ? `${e.phase}:${e.result.vital}:${e.result.ok}` : e.type))).toEqual([
      'revived:install:true',
      'revived:build:true',
      'revived:serve:true',
      'revived:render:true',
    ]);
    expect(r).toEqual({ ok: true, app, failed: null });
    expect(deps.runCommand).toHaveBeenNthCalledWith(1, ['npm', 'install', '--no-audit', '--no-fund'], expect.objectContaining({ cwd: '/work', timeoutMs: 120_000 }));
    expect(deps.startApp).toHaveBeenCalledWith(['node', 'server.js'], { cwd: '/work', port: 5001 });
    expect(app.stop).not.toHaveBeenCalled();
  });

  it('stops at a failed install, with the real output', async () => {
    const { deps } = fakeDeps({ runCommand: vi.fn(async () => done({ code: 1, output: 'npm error code EBADENGINE' })) });
    const { r, events } = await run(deps);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'vital', result: { vital: 'install', ok: false } });
    expect(JSON.stringify(events[0])).toContain('EBADENGINE');
    expect(r).toEqual({ ok: false, app: null, failed: 'install' });
    expect(deps.startApp).not.toHaveBeenCalled();
  });

  it('says how long a timed-out install ran', async () => {
    const { deps } = fakeDeps({ runCommand: vi.fn(async () => done({ code: null, timedOut: true })) });
    const { events } = await run(deps);
    expect(events[0]).toMatchObject({ result: { detail: 'timed out after 120s' } });
  });

  it('stops the app when render fails', async () => {
    const { deps, app } = fakeDeps({ renderCheck: vi.fn(async () => ({ ok: false, detail: 'page error: x is undefined' })) });
    const { r } = await run(deps);
    expect(r).toEqual({ ok: false, app: null, failed: 'render' });
    expect(app.stop).toHaveBeenCalled();
  });

  it('reports the app output when serve fails', async () => {
    const { deps, app } = fakeDeps({ waitForHttp: vi.fn(async () => ({ ok: false, detail: 'the app exited (code 1) before answering' })) });
    app.output = () => 'TypeError: util.puts is not a function';
    const { r, events } = await run(deps);
    expect(r.failed).toBe('serve');
    expect(JSON.stringify(events.at(-1))).toContain('util.puts is not a function');
    expect(app.stop).toHaveBeenCalled();
  });
});

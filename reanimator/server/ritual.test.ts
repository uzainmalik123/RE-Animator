import { existsSync } from 'node:fs';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { RitualEvent } from '../shared/ritual.js';
import type { CommandResult, RunningApp } from './exec.js';
import { PRACTICE_CORPSE, loadFixture } from './fixtures.js';
import { Rituals } from './ritual.js';
import type { VitalDeps } from './vitals.js';

const done = (code: number, output = ''): CommandResult => ({ code, output, timedOut: false, ms: 1 });

// Fake vitals: install fails while the copy still has the corpse's engines field, passes after the remedy.
function fakeDeps(o: { corpseDies?: boolean } = {}) {
  const apps: RunningApp[] = [];
  const deps: VitalDeps = {
    runCommand: vi.fn(async (argv: string[], { cwd }: { cwd: string }) => {
      if (argv[1] !== 'install' || o.corpseDies === false) return done(0);
      const pkg = await readFile(join(cwd, 'package.json'), 'utf8');
      return pkg.includes('0.10.x') ? done(1, 'npm error code EBADENGINE') : done(0);
    }),
    startApp: vi.fn((_argv: string[], { port }: { port: number }) => {
      const app: RunningApp = { origin: `http://127.0.0.1:${port}`, port, exited: new Promise(() => {}), output: () => '', stop: vi.fn(async () => {}) };
      apps.push(app);
      return app;
    }),
    freePort: vi.fn(async () => 5001),
    waitForHttp: vi.fn(async () => ({ ok: true, detail: 'HTTP 200' })),
    renderCheck: vi.fn(async () => ({ ok: true, detail: 'rendered: Guestbook' })),
  };
  return { deps, apps };
}

async function settle(r: Rituals, id: string): Promise<RitualEvent[]> {
  for (let i = 0; i < 200; i++) {
    const ev = r.events(id);
    if (ev?.done) return ev.log;
    await new Promise((res) => setTimeout(res, 5));
  }
  throw new Error('ritual never finished');
}

const make = async (o: { corpseDies?: boolean; onRelease?: () => Promise<void> } = {}) => {
  const { deps, apps } = fakeDeps(o);
  const workRoot = await mkdtemp(join(tmpdir(), 'rituals-'));
  return { r: new Rituals({ fixture: () => loadFixture(PRACTICE_CORPSE), deps, workRoot, onRelease: o.onRelease }), apps, workRoot, deps };
};

const start = (r: Rituals) => {
  const s = r.start();
  if ('busy' in s) throw new Error('busy');
  return s.id;
};

describe('Rituals', () => {
  it('proves the corpse dead, applies the remedy, then raises it', async () => {
    const { r } = await make();
    const log = await settle(r, start(r));
    expect(log.map((e) => (e.type === 'vital' ? `${e.phase}:${e.result.vital}:${e.result.ok}` : e.type))).toEqual([
      'started',
      'corpse:install:false',
      'remedy',
      'revived:install:true',
      'revived:build:true',
      'revived:serve:true',
      'revived:render:true',
      'risen',
    ]);
    expect(log[2]).toEqual({ type: 'remedy', files: 2 });
    await r.dispose();
  });

  it('refuses a second ritual while one runs, and stops the old app before the next', async () => {
    const { r, apps, deps } = await make();
    const id = start(r);
    expect(r.start()).toEqual({ busy: true, id });
    await settle(r, id);
    const id2 = start(r);
    await settle(r, id2);
    // The old app stopped before the new ritual started any app of its own.
    const stopped = vi.mocked(apps[0]!.stop).mock.invocationCallOrder[0]!;
    const nextStart = vi.mocked(deps.startApp).mock.invocationCallOrder[1]!;
    expect(stopped).toBeLessThan(nextStart);
    await r.dispose();
  });

  it('names the risen ritual\'s origin, revived repo and fixture, and nothing else', async () => {
    const { r } = await make();
    const id = start(r);
    expect(r.risen(id)).toBeNull();
    await settle(r, id);
    const risen = r.risen(id)!;
    expect(risen.origin).toBe('http://127.0.0.1:5001');
    expect(existsSync(join(risen.revivedDir, 'server.js'))).toBe(true);
    expect(risen.fixture.name).toBe('guestbook-2016');
    expect(r.risen('nope')).toBeNull();
    await r.dispose();
  });

  it('awaits onRelease (Death stopping) before the old app stops', async () => {
    const order: string[] = [];
    const { r, apps } = await make({
      onRelease: async () => {
        await new Promise((res) => setTimeout(res, 20));
        order.push('released');
      },
    });
    const id = start(r);
    await settle(r, id);
    vi.mocked(apps[0]!.stop).mockImplementation(async () => {
      order.push('stopped');
    });
    await settle(r, start(r));
    expect(order.slice(0, 2)).toEqual(['released', 'stopped']);
    await r.dispose();
  });

  it('refuses to raise a corpse that is not dead', async () => {
    const { r, apps } = await make({ corpseDies: false });
    const log = await settle(r, start(r));
    expect(log.at(-1)).toMatchObject({ type: 'failed', phase: 'corpse' });
    expect(JSON.stringify(log.at(-1))).toContain('not dead');
    expect(apps[0]!.stop).toHaveBeenCalled();
    await r.dispose();
  });

  it('stalls with the failing vital and its first line of output', async () => {
    const { r, deps } = await make();
    vi.mocked(deps.waitForHttp).mockResolvedValue({ ok: false, detail: 'the app exited (code 1) before answering' });
    const log = await settle(r, start(r));
    expect(log.at(-1)).toEqual({ type: 'failed', phase: 'revived', reason: 'serve: the app exited (code 1) before answering' });
    await r.dispose();
  });

  it('replays only the events after a given index', async () => {
    const { r } = await make();
    const id = start(r);
    const log = await settle(r, id);
    expect(r.events(id, 2)!.log).toEqual(log.slice(3));
    expect(r.events('nope')).toBeNull();
    await r.dispose();
  });

  it('notifies subscribers with each event index', async () => {
    const { r } = await make();
    const id = start(r);
    const seen: number[] = [];
    const off = r.subscribe(id, (_e, i) => seen.push(i));
    const log = await settle(r, id);
    off();
    expect(seen.at(-1)).toBe(log.length - 1);
    await r.dispose();
  });

  it('dispose stops the revived app and removes its work dir', async () => {
    const { r, apps, workRoot } = await make();
    await settle(r, start(r));
    const dirs = (await import('node:fs/promises')).readdir(workRoot);
    expect((await dirs).length).toBe(1);
    await r.dispose();
    expect(apps.at(-1)!.stop).toHaveBeenCalled();
    expect(existsSync(join(workRoot, (await dirs)[0]!))).toBe(false);
  });

  it('dispose during a ritual stops the running command promptly and starts no app', async () => {
    const { r, deps, workRoot } = await make();
    // An install that only ends when its signal aborts, like a slow npm install being killed.
    vi.mocked(deps.runCommand).mockImplementation(
      (_argv, o) =>
        new Promise((resolve) => {
          o.signal?.addEventListener('abort', () => resolve({ code: null, output: 'stopped', timedOut: false, ms: 1 }));
        }),
    );
    start(r);
    await new Promise((res) => setTimeout(res, 50));
    const t0 = Date.now();
    await r.dispose();
    expect(Date.now() - t0).toBeLessThan(1000);
    expect(deps.startApp).not.toHaveBeenCalled();
    expect((await (await import('node:fs/promises')).readdir(workRoot)).length).toBe(0);
  });

  describe('reraise (R5)', () => {
    it('stops the old app and raises the same body again on the four vitals', async () => {
      const { r, apps } = await make();
      const id = start(r);
      await settle(r, id);
      const seen: string[] = [];
      const out = await r.reraise(id, (v) => seen.push(`${v.vital}:${v.ok}`));
      expect(out).toEqual({ origin: 'http://127.0.0.1:5001' });
      expect(seen).toEqual(['install:true', 'build:true', 'serve:true', 'render:true']);
      expect(apps).toHaveLength(2);
      expect(apps[0]!.stop).toHaveBeenCalled();
      expect(r.body(id)).toMatchObject({ origin: 'http://127.0.0.1:5001' });
      expect(r.risen(id)).not.toBeNull();
      await r.dispose();
    });

    it('leaves the body down, but still there, when a vital fails', async () => {
      const { r, deps } = await make();
      const id = start(r);
      await settle(r, id);
      vi.mocked(deps.runCommand).mockImplementation(async (argv) => (argv[1] === 'run' ? done(1, '\nSyntaxError: boom\nmore') : done(0)));
      expect(await r.reraise(id, () => {})).toEqual({ failed: 'build: SyntaxError: boom' });
      expect(r.risen(id)).toBeNull();
      expect(r.body(id)).toMatchObject({ origin: null });
      expect(r.body(id)!.revivedDir).toMatch(/revived$/);
      await r.dispose();
    });

    it('knows no body for an unknown ritual', async () => {
      const { r } = await make();
      expect(r.body('nope')).toBeNull();
      expect(await r.reraise('nope', () => {})).toEqual({ failed: 'the ritual has not risen' });
    });
  });
});

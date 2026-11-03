import { existsSync } from 'node:fs';
import { CACHE_ONLY_MESSAGE, UsageError } from '@poltergeist/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WebSocket } from 'ws';
import { SandboxBusyError, SandboxClosedError, SandboxRuns, type SandboxRunsOptions } from '../../src/sandbox/runs.js';
import { fakeSummon, type FakeBehaviour } from './fake-summon.js';

const managers: SandboxRuns[] = [];
afterEach(async () => {
  await Promise.all(managers.splice(0).map((m) => m.close()));
});

function make(modes: FakeBehaviour[] = [], over: Partial<SandboxRunsOptions> = {}) {
  const fake = fakeSummon(() => modes.shift() ?? 'finish');
  const log = vi.fn();
  const runs = new SandboxRuns({ specDir: '/spec', cwd: '/', env: {}, runTimeoutMs: 60_000, keep: 5, summon: fake.fn, log, ...over });
  managers.push(runs);
  return { runs, fake, log };
}

async function settled(runs: SandboxRuns, id: string) {
  for (let i = 0; i < 200 && runs.get(id)?.summary.status === 'running'; i++) await new Promise((r) => setTimeout(r, 5));
  return runs.get(id)!.summary;
}

describe('SandboxRuns', () => {
  it('runs a haunting from the cache only and summarises it', async () => {
    const { runs, fake, log } = make();
    const id = await runs.start({ only: ['3.2'] });
    const s = await settled(runs, id);
    expect(s).toMatchObject({ runId: id, status: 'finished', haunted: ['3.2'], cacheMisses: 1, changes: [{ id: '3.2', from: 'clean', to: 'haunted' }] });
    expect(s.criteria).toEqual([{ id: '3.1', verdict: 'clean' }, { id: '3.2', verdict: 'haunted' }]);
    expect(typeof s.durationMs).toBe('number');
    const opts = fake.calls[0]!;
    expect(opts).toMatchObject({ only: ['3.2'], recompile: false, runId: id, specDir: '/spec' });
    await expect(opts.llm!.complete({} as never)).rejects.toThrow(CACHE_ONLY_MESSAGE);
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/1 cache miss/));
  });

  it('refuses a second run while one is going', async () => {
    const { runs } = make(['hang']);
    const id = await runs.start({});
    expect(runs.activeId()).toBe(id);
    const err = await runs.start({}).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SandboxBusyError);
    expect((err as SandboxBusyError).activeRunId).toBe(id);
  });

  it('passes a usage error through and keeps nothing', async () => {
    const { runs } = make(['usage']);
    await expect(runs.start({ only: ['9.9'] })).rejects.toBeInstanceOf(UsageError);
    expect(runs.list()).toEqual([]);
    expect(runs.activeId()).toBeUndefined();
  });

  it('aborts a run that outlives the timeout, then takes the next one', async () => {
    const { runs } = make(['hang'], { runTimeoutMs: 50 });
    const id = await runs.start({});
    expect((await settled(runs, id)).status).toBe('aborted');
    const next = await runs.start({});
    expect((await settled(runs, next)).status).toBe('finished');
  });

  it('hides the cause of a failed run from visitors', async () => {
    const { runs, log } = make(['crash']);
    const s = await settled(runs, await runs.start({}));
    expect(s).toMatchObject({ status: 'failed', error: 'run failed' });
    expect(JSON.stringify(s)).not.toContain('secret');
    expect(log).toHaveBeenCalledWith(expect.stringContaining('EACCES'));
  });

  it('keeps only the newest runs and deletes the evicted run folders', async () => {
    const { runs, fake } = make([], { keep: 2 });
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const id = await runs.start({});
      ids.push(id);
      await settled(runs, id);
    }
    expect(runs.list().map((s) => s.runId)).toEqual([ids[2], ids[1]]);
    expect(runs.get(ids[0]!)).toBeUndefined();
    expect(fake.dirs.map((d) => existsSync(d))).toEqual([false, true, true]);
  });

  it('streams public events on the run broadcast', async () => {
    const { runs } = make(['hang']);
    const id = await runs.start({});
    const sent: string[] = [];
    const ws = { readyState: 1, bufferedAmount: 0, send: (s: string) => sent.push(s), on: () => undefined, close: () => undefined, terminate: () => undefined };
    runs.get(id)!.broadcast.attach(ws as unknown as WebSocket);
    const started = sent.map((s) => JSON.parse(s) as { type: string; runDir?: string; specDir?: string }).find((m) => m.type === 'run.started');
    expect(started).toMatchObject({ runDir: '.', specDir: 'claims' });
  });

  it('closes viewers of a run that timed out, and a late viewer after the backlog', async () => {
    const { runs } = make(['hang'], { runTimeoutMs: 50 });
    const id = await runs.start({});
    const live = fakeWs();
    runs.get(id)!.broadcast.attach(live.socket);
    await settled(runs, id);
    expect(live.close).toHaveBeenCalledWith(1000, 'aborted');
    const late = fakeWs();
    runs.get(id)!.broadcast.attach(late.socket);
    expect(late.sent().map((m) => m.type)).toEqual(['live.hello', 'run.started']);
    expect(late.close).toHaveBeenCalledWith(1000, 'aborted');
  });

  it('closes viewers of a finished run', async () => {
    const { runs } = make();
    const id = await runs.start({});
    await settled(runs, id);
    const late = fakeWs();
    runs.get(id)!.broadcast.attach(late.socket);
    expect(late.sent().map((m) => m.type)).toEqual(['live.hello', 'run.started', 'run.finished']);
    expect(late.close).toHaveBeenCalledWith(1000, 'finished');
  });

  it('never summons once closing has begun', async () => {
    const { runs, fake } = make();
    const starting = runs.start({});
    await runs.close();
    await expect(starting).rejects.toThrow();
    expect(fake.calls).toHaveLength(0);
    await expect(runs.start({})).rejects.toBeInstanceOf(SandboxClosedError);
  });

  it('keeps the old runs when a request fails before starting', async () => {
    const { runs } = make(['finish', 'usage'], { keep: 1 });
    const id = await runs.start({});
    await settled(runs, id);
    await expect(runs.start({ only: ['9.9'] })).rejects.toBeInstanceOf(UsageError);
    expect(runs.list().map((s) => s.runId)).toEqual([id]);
  });
});

function fakeWs() {
  const sent: string[] = [];
  const ws = { readyState: 1, bufferedAmount: 0, send: (s: string) => sent.push(s), on: () => undefined, close: vi.fn(), terminate: () => undefined };
  return { socket: ws as unknown as WebSocket, close: ws.close, sent: () => sent.map((s) => JSON.parse(s) as { type: string }) };
}

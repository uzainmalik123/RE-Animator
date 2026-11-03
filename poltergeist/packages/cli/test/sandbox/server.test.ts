import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { startSandbox } from '../../src/sandbox/server.js';
import { fakeSummon, type FakeBehaviour } from './fake-summon.js';

const closers: (() => Promise<void>)[] = [];
afterEach(async () => {
  await Promise.all(closers.splice(0).map((c) => c()));
});

async function make(modes: FakeBehaviour[] = [], perClientHour = 0, runTimeoutMs = 60_000, maxClients?: number) {
  const fake = fakeSummon(() => modes.shift() ?? 'finish');
  const s = await startSandbox({ specDir: '/spec', cwd: '/', env: {}, runTimeoutMs, keep: 5, summon: fake.fn, port: 0, perClientHour, trustProxy: false, ...(maxClients ? { maxClients } : {}) });
  closers.push(() => s.close());
  const call = (path: string, init?: RequestInit) => fetch(`${s.url}${path}`, init);
  const post = (body?: string) => call('/runs', { method: 'POST', headers: { 'content-type': 'application/json' }, ...(body !== undefined ? { body } : {}) });
  const settled = async (id: string) => {
    for (let i = 0; i < 200; i++) {
      const res = (await (await call(`/runs/${id}`)).json()) as { status: string };
      if (res.status !== 'running') return res;
      await new Promise((r) => setTimeout(r, 5));
    }
    throw new Error('still running');
  };
  return { s, fake, call, post, settled };
}

describe('startSandbox', () => {
  it('reports health', async () => {
    const { call } = await make();
    const res = await call('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, busy: false, activeRunId: null, runs: 0 });
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('starts a run and reports its summary', async () => {
    const { post, settled, call, fake } = await make();
    const res = await post(JSON.stringify({ only: ['3.2'], personas: ['wraith'] }));
    expect(res.status).toBe(202);
    const body = (await res.json()) as { runId: string; status: string; live: string };
    expect(body).toEqual({ runId: body.runId, status: `/runs/${body.runId}`, live: `/runs/${body.runId}/live` });
    expect(await settled(body.runId)).toMatchObject({ status: 'finished', haunted: ['3.2'] });
    expect(fake.calls[0]).toMatchObject({ only: ['3.2'], personas: ['wraith'] });
    const list = (await (await call('/runs')).json()) as { runs: { runId: string }[] };
    expect(list.runs.map((r) => r.runId)).toEqual([body.runId]);
  });

  it('accepts an empty body', async () => {
    const { post } = await make();
    expect((await post()).status).toBe(202);
  });

  it('answers 409 while busy, and busy does not count', async () => {
    const { post, settled } = await make(['hang'], 2, 200);
    const first = (await (await post('{}')).json()) as { runId: string };
    const busy = await post('{}');
    expect(busy.status).toBe(409);
    expect(await busy.json()).toEqual({ error: 'busy', runId: first.runId });
    expect(await settled(first.runId)).toMatchObject({ status: 'aborted' });
    const second = await post('{}');
    expect(second.status).toBe(202);
    await settled(((await second.json()) as { runId: string }).runId);
    expect((await post('{}')).status).toBe(429);
  });

  it('rate-limits per client with Retry-After', async () => {
    const { post, settled } = await make([], 1);
    const first = (await (await post('{}')).json()) as { runId: string };
    await settled(first.runId);
    const limited = await post('{}');
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBe('3600');
    expect(await limited.json()).toEqual({ error: 'rate limited', retryAfterSec: 3600 });
  });

  it('rejects malformed bodies without starting a run', async () => {
    const { post, call } = await make();
    for (const body of ['nope', '[]', '{"reps":3}', '{"only":[1]}', '{"only":"3.2"}', `{"only":[${Array.from({ length: 65 }, () => '"1.1"').join(',')}]}`]) {
      expect((await post(body)).status, body).toBe(400);
    }
    expect((await post(JSON.stringify({ only: ['x'.repeat(5000)] }))).status).toBe(413);
    expect(((await (await call('/runs')).json()) as { runs: unknown[] }).runs).toEqual([]);
  });

  it('returns a usage error as 400', async () => {
    const { post } = await make(['usage']);
    const res = await post('{"only":["9.9"]}');
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(/unknown criterion id: 9\.9/);
  });

  it('answers preflight, unknown paths and wrong methods', async () => {
    const { call } = await make();
    const pre = await call('/runs', { method: 'OPTIONS' });
    expect(pre.status).toBe(204);
    expect(pre.headers.get('access-control-allow-methods')).toBe('GET, POST, OPTIONS');
    expect(pre.headers.get('access-control-allow-headers')).toBe('content-type');
    expect((await call('/nope')).status).toBe(404);
    expect((await call('/runs/unknown')).status).toBe(404);
    expect((await call('/health', { method: 'POST' })).status).toBe(405);
    expect((await call('/runs', { method: 'DELETE' })).status).toBe(405);
  });

  it('serves a late joiner on a finished run the whole feed', async () => {
    const { post, settled, s } = await make();
    const { runId } = (await (await post('{}')).json()) as { runId: string };
    await settled(runId);
    const ws = new WebSocket(`${s.url.replace('http', 'ws')}/runs/${runId}/live`, { origin: 'https://judge.example' });
    const got: { type: string; runDir?: string }[] = [];
    await new Promise<void>((resolve, reject) => {
      ws.on('message', (d) => {
        got.push(JSON.parse(String(d)) as { type: string });
        if (got.at(-1)!.type === 'run.finished') resolve();
      });
      ws.on('error', reject);
    });
    ws.close();
    expect(got.map((m) => m.type)).toEqual(['live.hello', 'run.started', 'run.finished']);
    expect(got[1]!.runDir).toBe('.');
  });

  it('refuses a live socket for an unknown run', async () => {
    const { s } = await make();
    const ws = new WebSocket(`${s.url.replace('http', 'ws')}/runs/nope/live`);
    const err = await new Promise<Error>((resolve) => ws.on('error', resolve));
    expect(err.message).toMatch(/404/);
  });

  it('refuses live sockets beyond the cap', async () => {
    const { post, s } = await make(['hang'], 0, 60_000, 1);
    const { live } = (await (await post('{}')).json()) as { live: string };
    const url = `${s.url.replace('http', 'ws')}${live}`;
    const first = new WebSocket(url);
    await new Promise((r) => first.on('open', r));
    const err = await new Promise<Error>((resolve) => new WebSocket(url).on('error', resolve));
    expect(err.message).toMatch(/503/);
    first.close();
  });

  it('does not echo a usage error that names a local path', async () => {
    const { post } = await make(['usage-path']);
    const res = await post('{}');
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'bad request' });
  });
});

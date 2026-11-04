import { describe, expect, it } from 'vitest';
import type { RitualEvent } from '../shared/ritual.js';
import { createApp, type RitualsApi } from './app.js';

const BASE = 'http://127.0.0.1:7070';

const LOG: RitualEvent[] = [
  { type: 'started', repo: 'guestbook-2016', diedIn: 2016 },
  { type: 'remedy', files: 2 },
  { type: 'risen', origin: 'http://127.0.0.1:5001' },
];

// A finished ritual 'r1', and a busy flag the second start trips.
function fakeRituals(): RitualsApi {
  let started = false;
  return {
    start: () => {
      if (started) return { busy: true, id: 'r1' };
      started = true;
      return { id: 'r1' };
    },
    events: (id, after = -1) => (id === 'r1' ? { log: LOG.slice(after + 1), done: true } : null),
    subscribe: () => () => {},
  };
}

describe('createApp', () => {
  it('reports health', async () => {
    const res = await createApp().request(`${BASE}/api/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, name: 'reanimator' });
  });

  it('404s unknown api paths', async () => {
    const res = await createApp().request(`${BASE}/api/nope`);
    expect(res.status).toBe(404);
  });

  it('guards every api route (KI-R12)', async () => {
    const res = await createApp().request(`${BASE}/api/health`, { headers: { host: 'evil.example' } });
    expect(res.status).toBe(403);
  });

  it('starts one ritual at a time', async () => {
    const app = createApp({ rituals: fakeRituals() });
    const first = await app.request(`${BASE}/api/rituals`, { method: 'POST' });
    expect(first.status).toBe(202);
    expect(await first.json()).toEqual({ id: 'r1' });
    const second = await app.request(`${BASE}/api/rituals`, { method: 'POST' });
    expect(second.status).toBe(409);
    expect(await second.json()).toEqual({ error: 'a ritual is already running', id: 'r1' });
  });

  it('404s events for an unknown ritual', async () => {
    const res = await createApp({ rituals: fakeRituals() }).request(`${BASE}/api/rituals/nope/events`);
    expect(res.status).toBe(404);
  });

  it('streams the event log as SSE with ids', async () => {
    const res = await createApp({ rituals: fakeRituals() }).request(`${BASE}/api/rituals/r1/events`);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const body = await res.text();
    expect(body).toContain('id: 0');
    expect(body).toContain('id: 2');
    expect(body).toContain('"type":"risen"');
  });

  it('resumes after Last-Event-ID without repeating events', async () => {
    const res = await createApp({ rituals: fakeRituals() }).request(`${BASE}/api/rituals/r1/events`, {
      headers: { 'last-event-id': '1' },
    });
    const body = await res.text();
    expect(body).not.toContain('id: 0');
    expect(body).not.toContain('id: 1');
    expect(body).toContain('id: 2');
  });

  it('treats a negative Last-Event-ID as a fresh start', async () => {
    const res = await createApp({ rituals: fakeRituals() }).request(`${BASE}/api/rituals/r1/events`, {
      headers: { 'last-event-id': '-5' },
    });
    const body = await res.text();
    expect(body.match(/^id: (-?\d+)$/m)?.[1]).toBe('0');
    expect(body).not.toContain('id: -');
  });

  it('streams live events until the ritual ends', async () => {
    let push: ((e: RitualEvent, i: number) => void) | null = null;
    const rituals: RitualsApi = {
      start: () => ({ id: 'r1' }),
      events: (id, after = -1) => (id === 'r1' ? { log: LOG.slice(0, 1).slice(after + 1), done: false } : null),
      subscribe: (_id, fn) => {
        push = fn;
        return () => {};
      },
    };
    const res = await createApp({ rituals }).request(`${BASE}/api/rituals/r1/events`);
    const body = res.text();
    await new Promise((r) => setTimeout(r, 10));
    push!(LOG[0]!, 0); // a duplicate of the replayed event: must not be sent twice
    push!(LOG[1]!, 1);
    push!(LOG[2]!, 2);
    const text = await body;
    expect(text.match(/id: 0/g)).toHaveLength(1);
    expect(text).toContain('id: 1');
    expect(text).toContain('"type":"risen"');
  });
});

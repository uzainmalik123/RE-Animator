import { describe, expect, it, vi } from 'vitest';
import type { RitualEvent } from '../../shared/ritual';
import { connectRitual, requestRitual, type EventSourceLike } from './ritualClient';

const json = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status });

describe('requestRitual', () => {
  it('returns the new ritual id', async () => {
    expect(await requestRitual(json(202, { id: 'r1' }))).toEqual({ id: 'r1' });
  });

  it('attaches to the ritual already running (a reload mid-ritual)', async () => {
    expect(await requestRitual(json(409, { error: 'a ritual is already running', id: 'r0' }))).toEqual({ id: 'r0' });
  });

  it('explains a backend that is down', async () => {
    const r = await requestRitual(async () => {
      throw new TypeError('fetch failed');
    });
    expect(r).toEqual({ error: 'the backend is not answering (npm run server)' });
  });

  it('names the grave to raise (R9)', async () => {
    const fetchFn = vi.fn(json(202, { id: 'r1' }));
    expect(await requestRitual(fetchFn, { repo: 'https://github.com/a/b' })).toEqual({ id: 'r1' });
    expect(fetchFn).toHaveBeenCalledWith('/api/rituals', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ repo: 'https://github.com/a/b' }) });
  });

  it('passes on why a grave was refused', async () => {
    expect(await requestRitual(json(400, { error: 'repo must be https://github.com/<owner>/<repo>' }), { repo: 'x' })).toEqual({ error: 'repo must be https://github.com/<owner>/<repo>' });
  });

  it('names a prepared grave by id (R6)', async () => {
    const fetchFn = vi.fn(json(202, { id: 'r1' }));
    expect(await requestRitual(fetchFn, { grave: 'tally-2014' })).toEqual({ id: 'r1' });
    expect(fetchFn).toHaveBeenCalledWith('/api/rituals', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ grave: 'tally-2014' }) });
  });

  it('passes on why a grave is not there (404)', async () => {
    expect(await requestRitual(json(404, { error: 'no such grave' }), { grave: 'nope' })).toEqual({ error: 'no such grave' });
  });

  it('explains a refusal', async () => {
    expect(await requestRitual(json(403, { error: 'forbidden' }))).toEqual({ error: 'the backend refused the ritual (HTTP 403)' });
  });
});

class FakeSource implements EventSourceLike {
  static CLOSED = 2;
  readyState = 1;
  onmessage: ((m: MessageEvent<string>) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  close = vi.fn(() => {
    this.readyState = FakeSource.CLOSED;
  });
  constructor(public url: string) {}
  send(e: RitualEvent) {
    this.onmessage?.({ data: JSON.stringify(e) } as MessageEvent<string>);
  }
}

describe('connectRitual', () => {
  const setup = () => {
    let src: FakeSource | null = null;
    const events: RitualEvent[] = [];
    const lost = vi.fn();
    connectRitual('r 1', { onEvent: (e) => events.push(e), onLost: lost }, (url) => (src = new FakeSource(url)));
    return { src: src!, events, lost };
  };

  it('subscribes to the encoded events URL and forwards events', () => {
    const { src, events } = setup();
    expect(src.url).toBe('/api/rituals/r%201/events');
    src.send({ type: 'remedy', files: 2 });
    expect(events).toEqual([{ type: 'remedy', files: 2 }]);
  });

  it('closes on the terminal event', () => {
    const { src, lost } = setup();
    src.send({ type: 'risen', origin: 'http://127.0.0.1:1' });
    expect(src.close).toHaveBeenCalled();
    src.onerror?.(new Event("error"));
    expect(lost).not.toHaveBeenCalled();
  });

  it('reports a stream the browser gave up on', () => {
    const { src, lost } = setup();
    src.readyState = FakeSource.CLOSED;
    src.onerror?.(new Event("error"));
    expect(lost).toHaveBeenCalledWith('lost the ritual: the backend stopped answering');
  });

  it('lets the browser retry a transient drop', () => {
    const { src, lost } = setup();
    src.readyState = 0; // CONNECTING: EventSource resumes with Last-Event-ID itself
    src.onerror?.(new Event("error"));
    expect(lost).not.toHaveBeenCalled();
  });
});

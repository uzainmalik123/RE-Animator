import { describe, expect, it, vi } from 'vitest';
import type { AttackEvent } from '../../shared/attack';
import type { EventSourceLike } from '../raise/ritualClient';
import { connectAttack, requestAttack } from './attackClient';

const json = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status });

describe('requestAttack', () => {
  it('posts to the ritual and returns the attack id', async () => {
    const fetchFn = vi.fn(json(202, { id: 'a1' }));
    expect(await requestAttack(fetchFn, 'r 1')).toEqual({ id: 'a1' });
    expect(fetchFn).toHaveBeenCalledWith('/api/rituals/r%201/attack', { method: 'POST' });
  });

  it('rejoins the attack already running', async () => {
    expect(await requestAttack(json(409, { error: 'Death is already attacking', id: 'a0' }), 'r1')).toEqual({ id: 'a0' });
  });

  it('passes on the backend\'s reason for a refusal', async () => {
    expect(await requestAttack(json(409, { error: 'the ritual has not risen' }), 'r1')).toEqual({ error: 'the ritual has not risen' });
    expect(await requestAttack(json(500, {}), 'r1')).toEqual({ error: 'the backend refused Death (HTTP 500)' });
  });

  it('explains a backend that is down', async () => {
    const r = await requestAttack(async () => {
      throw new TypeError('fetch failed');
    }, 'r1');
    expect(r).toEqual({ error: 'the backend is not answering (npm run server)' });
  });
});

class FakeSource implements EventSourceLike {
  readyState = 1;
  onmessage: ((m: MessageEvent<string>) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  close = vi.fn(() => {
    this.readyState = 2;
  });
  constructor(public url: string) {}
  send(e: AttackEvent) {
    this.onmessage?.({ data: JSON.stringify(e) } as MessageEvent<string>);
  }
}

describe('connectAttack', () => {
  it('follows the attack until it ends, then closes', () => {
    let src: FakeSource | null = null;
    const events: AttackEvent[] = [];
    connectAttack('a 1', { onEvent: (e) => events.push(e), onLost: vi.fn() }, (url) => (src = new FakeSource(url)));
    expect(src!.url).toBe('/api/attacks/a%201/events');
    src!.send({ type: 'summoned', origin: 'o', only: null, heal: null, body: '/b', wounds: [], healed: [] });
    expect(src!.close).not.toHaveBeenCalled();
    src!.send({ type: 'failed', reason: 'boom' });
    expect(events).toHaveLength(2);
    expect(src!.close).toHaveBeenCalled();
  });

  it('reports a stream the browser gave up on', () => {
    let src: FakeSource | null = null;
    const lost = vi.fn();
    connectAttack('a1', { onEvent: vi.fn(), onLost: lost }, (url) => (src = new FakeSource(url)));
    src!.readyState = 2;
    src!.onerror?.(new Event('error'));
    expect(lost).toHaveBeenCalledWith('lost Death: the backend stopped answering');
  });
});

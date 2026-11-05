import { describe, expect, it, vi } from 'vitest';
import type { SpellEvent } from '../../shared/grimoire';
import type { EventSourceLike } from '../raise/ritualClient';
import { connectSpell, requestSpell, stopSpell } from './grimoireClient';

const json = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status });

describe('requestSpell', () => {
  it('posts the spell, and the wound it heals, as JSON', async () => {
    const fetchFn = vi.fn(json(202, { id: 's1' }));
    expect(await requestSpell(fetchFn, 'r 1', 'fix it', { criterion: '1.2', persona: 'wraith' })).toEqual({ id: 's1' });
    expect(fetchFn).toHaveBeenCalledWith('/api/rituals/r%201/spells', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"text":"fix it","heal":{"criterion":"1.2","persona":"wraith"}}',
    });
  });

  it('rejoins the spell already being cast', async () => {
    expect(await requestSpell(json(409, { error: 'Kiro is already casting', id: 's0' }), 'r1', 'x')).toEqual({ id: 's0' });
  });

  it("passes on the backend's reason for a refusal, and explains a backend that is down", async () => {
    expect(await requestSpell(json(409, { error: 'Death is attacking; wait for him' }), 'r1', 'x')).toEqual({ error: 'Death is attacking; wait for him' });
    expect(await requestSpell(json(500, {}), 'r1', 'x')).toEqual({ error: 'the backend refused the spell (HTTP 500)' });
    const down = await requestSpell(async () => {
      throw new TypeError('fetch failed');
    }, 'r1', 'x');
    expect(down).toEqual({ error: 'the backend is not answering (npm run server)' });
  });
});

describe('stopSpell', () => {
  it('breaks the spell off, and shrugs off a backend that is down', async () => {
    const fetchFn = vi.fn(json(202, {}));
    await stopSpell(fetchFn, 's 1');
    expect(fetchFn).toHaveBeenCalledWith('/api/spells/s%201/stop', { method: 'POST' });
    await stopSpell(async () => {
      throw new TypeError('down');
    }, 's1');
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
  send(e: SpellEvent) {
    this.onmessage?.({ data: JSON.stringify(e) } as MessageEvent<string>);
  }
}

describe('connectSpell', () => {
  it('follows the spell to its seal, then closes', () => {
    let src: FakeSource | null = null;
    const events: SpellEvent[] = [];
    connectSpell('s 1', { onEvent: (e) => events.push(e), onLost: vi.fn() }, (url) => (src = new FakeSource(url)));
    expect(src!.url).toBe('/api/spells/s%201/events');
    src!.send({ type: 'quill', text: 'hi' });
    expect(src!.close).not.toHaveBeenCalled();
    src!.send({ type: 'sealed', stopReason: 'end_turn' });
    expect(events).toHaveLength(2);
    expect(src!.close).toHaveBeenCalled();
  });

  it('reports a stream the browser gave up on', () => {
    let src: FakeSource | null = null;
    const lost = vi.fn();
    connectSpell('s1', { onEvent: vi.fn(), onLost: lost }, (url) => (src = new FakeSource(url)));
    src!.readyState = 2;
    src!.onerror?.(new Event('error'));
    expect(lost).toHaveBeenCalledWith('lost the grimoire: the backend stopped answering');
  });
});

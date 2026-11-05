import type { HealTarget } from '../../shared/attack';
import { spellOver, type SpellEvent } from '../../shared/grimoire';
import type { EventSourceLike, FetchLike } from '../raise/ritualClient';

// The browser side of the grimoire (R7, D-R21), shaped like the attack's transport.

// Cast a spell on a risen ritual, or rejoin the one already being cast (409 with its id).
export async function requestSpell(fetchFn: FetchLike, ritualId: string, text: string, heal?: HealTarget): Promise<{ id: string } | { error: string }> {
  let res: Response;
  const init = { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, heal }) };
  try {
    res = await fetchFn(`/api/rituals/${encodeURIComponent(ritualId)}/spells`, init);
  } catch {
    return { error: 'the backend is not answering (npm run server)' };
  }
  const body = (await res.json().catch(() => ({}))) as { id?: unknown; error?: unknown };
  if ((res.status === 202 || res.status === 409) && typeof body.id === 'string') return { id: body.id };
  return { error: typeof body.error === 'string' ? body.error : `the backend refused the spell (HTTP ${res.status})` };
}

// Break the spell off; its stream then ends `failed`, which is how the page learns it stopped.
export async function stopSpell(fetchFn: FetchLike, id: string): Promise<void> {
  await fetchFn(`/api/spells/${encodeURIComponent(id)}/stop`, { method: 'POST' }).catch(() => undefined);
}

const CLOSED = 2; // EventSource.CLOSED

// Follow a spell's events until it is sealed or fails; a stream the browser gives up on is onLost.
export function connectSpell(
  id: string,
  on: { onEvent: (e: SpellEvent) => void; onLost: (reason: string) => void },
  open: (url: string) => EventSourceLike = (url) => new EventSource(url),
): EventSourceLike {
  const es = open(`/api/spells/${encodeURIComponent(id)}/events`);
  let finished = false;
  es.onmessage = (m) => {
    const e = JSON.parse(m.data) as SpellEvent;
    on.onEvent(e);
    if (spellOver(e)) {
      finished = true;
      es.close();
    }
  };
  es.onerror = () => {
    if (finished || es.readyState !== CLOSED) return;
    es.close();
    on.onLost('lost the grimoire: the backend stopped answering');
  };
  return es;
}

import { attackOver, type AttackEvent } from '../../shared/attack';
import type { EventSourceLike, FetchLike } from '../raise/ritualClient';

// The browser side of Death's attack (D-R17), shaped like the ritual's transport.

// Summon Death on a risen ritual, or rejoin the attack already running (409 with its id).
export async function requestAttack(fetchFn: FetchLike, ritualId: string): Promise<{ id: string } | { error: string }> {
  let res: Response;
  try {
    res = await fetchFn(`/api/rituals/${encodeURIComponent(ritualId)}/attack`, { method: 'POST' });
  } catch {
    return { error: 'the backend is not answering (npm run server)' };
  }
  const body = (await res.json().catch(() => ({}))) as { id?: unknown; error?: unknown };
  if ((res.status === 202 || res.status === 409) && typeof body.id === 'string') return { id: body.id };
  return { error: typeof body.error === 'string' ? body.error : `the backend refused Death (HTTP ${res.status})` };
}

const CLOSED = 2; // EventSource.CLOSED

// Follow an attack's events until it finishes or fails; a stream the browser gives up on is onLost.
export function connectAttack(
  id: string,
  on: { onEvent: (e: AttackEvent) => void; onLost: (reason: string) => void },
  open: (url: string) => EventSourceLike = (url) => new EventSource(url),
): EventSourceLike {
  const es = open(`/api/attacks/${encodeURIComponent(id)}/events`);
  let finished = false;
  es.onmessage = (m) => {
    const e = JSON.parse(m.data) as AttackEvent;
    on.onEvent(e);
    if (attackOver(e)) {
      finished = true;
      es.close();
    }
  };
  es.onerror = () => {
    if (finished || es.readyState !== CLOSED) return;
    es.close();
    on.onLost('lost Death: the backend stopped answering');
  };
  return es;
}

// R4: one of the engine's frames of the app under attack (GET /api/attacks/:id/frames/:ghost/:seq).
export const frameUrl = (attackId: string, ghostId: string, seq: number) =>
  `/api/attacks/${encodeURIComponent(attackId)}/frames/${encodeURIComponent(ghostId)}/${seq}`;

import type { RitualEvent } from '../../shared/ritual';

// The browser side of the ritual transport (D-R15), kept free of React so it can be tested.

export type FetchLike = (url: string, init: { method: string }) => Promise<Response>;

// Start a ritual, or attach to the one already running (409 carries its id, so a reload mid-ritual
// rejoins it instead of being locked out).
export async function requestRitual(fetchFn: FetchLike): Promise<{ id: string } | { error: string }> {
  let res: Response;
  try {
    res = await fetchFn('/api/rituals', { method: 'POST' });
  } catch {
    return { error: 'the backend is not answering (npm run server)' };
  }
  if (res.status === 202 || res.status === 409) {
    const body = (await res.json().catch(() => ({}))) as { id?: unknown };
    if (typeof body.id === 'string') return { id: body.id };
  }
  return { error: `the backend refused the ritual (HTTP ${res.status})` };
}

export interface EventSourceLike {
  readyState: number;
  onmessage: ((m: MessageEvent<string>) => void) | null;
  onerror: ((e: Event) => void) | null;
  close(): void;
}

const CLOSED = 2; // EventSource.CLOSED

// Follow a ritual's events. A transient drop is retried by the browser (with Last-Event-ID); a
// stream it gives up on (the backend restarted, the ritual is gone) is reported via onLost.
export function connectRitual(
  id: string,
  on: { onEvent: (e: RitualEvent) => void; onLost: (reason: string) => void },
  open: (url: string) => EventSourceLike = (url) => new EventSource(url),
): EventSourceLike {
  const es = open(`/api/rituals/${encodeURIComponent(id)}/events`);
  let finished = false;
  es.onmessage = (m) => {
    const e = JSON.parse(m.data) as RitualEvent;
    on.onEvent(e);
    if (e.type === 'risen' || e.type === 'failed') {
      finished = true;
      es.close();
    }
  };
  es.onerror = () => {
    if (finished || es.readyState !== CLOSED) return;
    es.close();
    on.onLost('lost the ritual: the backend stopped answering');
  };
  return es;
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { IDLE, reduceRitual, type RitualEvent, type RitualState } from '../../shared/ritual';

// Start a ritual on the backend and fold its SSE stream into state (D-R15). The browser's
// EventSource resumes with Last-Event-ID on a dropped connection; we close it on the terminal event.
export function useRitual(): { state: RitualState; start: () => Promise<void>; error: string | null } {
  const [state, setState] = useState<RitualState>(IDLE);
  const [error, setError] = useState<string | null>(null);
  const source = useRef<EventSource | null>(null);

  useEffect(() => () => source.current?.close(), []);

  const start = useCallback(async () => {
    setError(null);
    let res: Response;
    try {
      res = await fetch('/api/rituals', { method: 'POST' });
    } catch {
      setError('the backend is not answering (npm run server)');
      return;
    }
    if (res.status === 409) {
      setError('a ritual is already running');
      return;
    }
    if (!res.ok) {
      setError(`the backend refused the ritual (HTTP ${res.status})`);
      return;
    }
    const { id } = (await res.json()) as { id: string };
    source.current?.close();
    setState(IDLE);
    const es = new EventSource(`/api/rituals/${encodeURIComponent(id)}/events`);
    source.current = es;
    es.onmessage = (m: MessageEvent<string>) => {
      const e = JSON.parse(m.data) as RitualEvent;
      setState((s) => reduceRitual(s, e));
      if (e.type === 'risen' || e.type === 'failed') es.close();
    };
  }, []);

  return { state, start, error };
}

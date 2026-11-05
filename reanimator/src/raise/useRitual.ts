import { useCallback, useEffect, useRef, useState } from 'react';
import { IDLE, reduceRitual, type RitualState } from '../../shared/ritual';
import { connectRitual, requestRitual, type EventSourceLike } from './ritualClient';

// Start (or rejoin) a ritual on the backend and fold its SSE stream into state (D-R15).
export type RitualHandle = { state: RitualState; id: string | null; start: () => Promise<void>; error: string | null };

export function useRitual(): RitualHandle {
  const [state, setState] = useState<RitualState>(IDLE);
  const [error, setError] = useState<string | null>(null);
  const [id, setId] = useState<string | null>(null);
  const source = useRef<EventSourceLike | null>(null);

  useEffect(() => () => source.current?.close(), []);

  const start = useCallback(async () => {
    setError(null);
    const r = await requestRitual((url, init) => fetch(url, init));
    if ('error' in r) {
      setError(r.error);
      return;
    }
    source.current?.close();
    setState(IDLE);
    setId(r.id);
    source.current = connectRitual(r.id, {
      onEvent: (e) => setState((s) => reduceRitual(s, e)),
      onLost: (reason) => {
        setError(reason);
        // The ritual is gone with the backend: free the button so the user can begin again.
        setState((s) => (s.status === 'examining' || s.status === 'raising' ? { ...s, status: 'failed', failure: reason } : s));
      },
    });
  }, []);

  return { state, id, start, error };
}

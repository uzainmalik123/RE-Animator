import { useCallback, useEffect, useRef, useState } from 'react';
import { IDLE, reduceRitual, type RitualState } from '../../shared/ritual';
import { connectRitual, requestRitual, type EventSourceLike, type RitualTarget } from './ritualClient';

// Start (or rejoin) a ritual on the backend and fold its SSE stream into state (D-R15).
// `start` resolves true once the backend accepted (or rejoined) a ritual, false when it refused one
// (the reason is in `error`). `reset` lets a finished ritual go, back to the idle graveyard (R6).
export type RitualHandle = { state: RitualState; id: string | null; start: (target?: RitualTarget) => Promise<boolean>; reset: () => void; error: string | null };

export function useRitual(): RitualHandle {
  const [state, setState] = useState<RitualState>(IDLE);
  const [error, setError] = useState<string | null>(null);
  const [id, setId] = useState<string | null>(null);
  const source = useRef<EventSourceLike | null>(null);

  useEffect(() => () => source.current?.close(), []);

  const start = useCallback(async (target?: RitualTarget) => {
    setError(null);
    const r = await requestRitual((url, init) => fetch(url, init), target);
    if ('error' in r) {
      setError(r.error);
      return false;
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
    return true;
  }, []);

  const reset = useCallback(() => {
    source.current?.close();
    source.current = null;
    setState(IDLE);
    setId(null);
    setError(null);
  }, []);

  return { state, id, start, reset, error };
}

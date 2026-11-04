import { useCallback, useEffect, useRef, useState } from 'react';
import { QUIET, reduceAttack, type AttackState } from '../../shared/attack';
import type { EventSourceLike } from '../raise/ritualClient';
import { connectAttack, requestAttack } from './attackClient';

// Summon Death on the risen ritual and fold the attack's SSE stream into state (D-R17).
export function useAttack(ritualId: string | null): { state: AttackState; summon: () => Promise<void>; error: string | null } {
  const [state, setState] = useState<AttackState>(QUIET);
  const [error, setError] = useState<string | null>(null);
  const source = useRef<EventSourceLike | null>(null);

  useEffect(() => () => source.current?.close(), []);

  const summon = useCallback(async () => {
    if (!ritualId) return;
    setError(null);
    const r = await requestAttack((url, init) => fetch(url, init), ritualId);
    if ('error' in r) {
      setError(r.error);
      return;
    }
    source.current?.close();
    setState(QUIET);
    source.current = connectAttack(r.id, {
      onEvent: (e) => setState((s) => reduceAttack(s, e)),
      onLost: (reason) => {
        setError(reason);
        setState((s) => (s.status === 'attacking' ? { ...s, status: 'failed', failure: reason } : s));
      },
    });
  }, [ritualId]);

  return { state, summon, error };
}

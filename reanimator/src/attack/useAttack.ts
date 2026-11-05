import { useCallback, useEffect, useRef, useState } from 'react';
import { QUIET, reduceAttack, type AttackState } from '../../shared/attack';
import type { EventSourceLike } from '../raise/ritualClient';
import { connectAttack, requestAttack } from './attackClient';

export type AttackHandle = { id: string | null; state: AttackState; summon: () => Promise<void>; error: string | null };

type Run = { ritual: string | null; id: string | null; state: AttackState; error: string | null };
const NONE: Run = { ritual: null, id: null, state: QUIET, error: null };

// Summon Death on the risen ritual and fold the attack's SSE stream into state (D-R17). Everything is
// tagged with its ritual, so a new ritual starts from QUIET (and its old stream is closed).
export function useAttack(ritualId: string | null): AttackHandle {
  const [run, setRun] = useState<Run>(NONE);
  const source = useRef<EventSourceLike | null>(null);

  useEffect(() => () => source.current?.close(), [ritualId]);

  const summon = useCallback(async () => {
    if (!ritualId) return;
    setRun((r) => ({ ...(r.ritual === ritualId ? r : NONE), ritual: ritualId, error: null }));
    const r = await requestAttack((url, init) => fetch(url, init), ritualId);
    if ('error' in r) {
      setRun((x) => ({ ...x, error: r.error }));
      return;
    }
    source.current?.close();
    setRun({ ritual: ritualId, id: r.id, state: QUIET, error: null });
    const mine = (x: Run) => x.id === r.id;
    source.current = connectAttack(r.id, {
      onEvent: (e) => setRun((x) => (mine(x) ? { ...x, state: reduceAttack(x.state, e) } : x)),
      onLost: (reason) =>
        setRun((x) => (mine(x) ? { ...x, error: reason, state: x.state.status === 'attacking' ? { ...x.state, status: 'failed', failure: reason } : x.state } : x)),
    });
  }, [ritualId]);

  const current = run.ritual === ritualId ? run : NONE;
  return { id: current.id, state: current.state, summon, error: current.error };
}

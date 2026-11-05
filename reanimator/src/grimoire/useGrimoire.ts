import { useCallback, useEffect, useRef, useState } from 'react';
import type { HealTarget } from '../../shared/attack';
import { BLANK, reduceGrimoire, type GrimoireState } from '../../shared/grimoire';
import type { EventSourceLike } from '../raise/ritualClient';
import { connectSpell, requestSpell, stopSpell } from './grimoireClient';

export type GrimoireHandle = { id: string | null; state: GrimoireState; cast: (text: string, heal?: HealTarget) => Promise<void>; stop: () => Promise<void>; error: string | null };

type Book = { ritual: string | null; id: string | null; state: GrimoireState; error: string | null };
const NONE: Book = { ritual: null, id: null, state: BLANK, error: null };

// One grimoire per ritual: each spell's stream folds onto the same book, so earlier pages stay. A
// new ritual starts BLANK (and its old stream is closed), like useAttack.
export function useGrimoire(ritualId: string | null): GrimoireHandle {
  const [book, setBook] = useState<Book>(NONE);
  const source = useRef<EventSourceLike | null>(null);

  useEffect(() => () => source.current?.close(), [ritualId]);

  const cast = useCallback(
    async (text: string, heal?: HealTarget) => {
      if (!ritualId) return;
      setBook((b) => ({ ...(b.ritual === ritualId ? b : NONE), ritual: ritualId, error: null }));
      const r = await requestSpell((url, init) => fetch(url, init), ritualId, text, heal);
      if ('error' in r) {
        setBook((b) => ({ ...b, error: r.error }));
        return;
      }
      source.current?.close();
      setBook((b) => ({ ...(b.ritual === ritualId ? b : NONE), ritual: ritualId, id: r.id, error: null }));
      const mine = (b: Book) => b.id === r.id;
      source.current = connectSpell(r.id, {
        onEvent: (e) => setBook((b) => (mine(b) ? { ...b, state: reduceGrimoire(b.state, e) } : b)),
        onLost: (reason) =>
          setBook((b) => (mine(b) ? { ...b, error: reason, state: b.state.status === 'casting' ? { ...b.state, status: 'failed', failure: reason } : b.state } : b)),
      });
    },
    [ritualId],
  );

  const current = book.ritual === ritualId ? book : NONE;
  const id = current.id;
  const stop = useCallback(async () => {
    if (id) await stopSpell((url, init) => fetch(url, init), id);
  }, [id]);

  return { id, state: current.state, cast, stop, error: current.error };
}

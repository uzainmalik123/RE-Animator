import { useEffect, useState } from 'react';
import type { Headstone } from '../../shared/graveyard';
import { fetchGraveyard } from './graveyardClient';

// The graves to choose from: `graves` is null until the backend has answered. Loaded each time the
// graveyard is `active` (opening it, or coming back to it), so a backend that was down is retried.
export type GraveyardHandle = { graves: Headstone[] | null; error: string | null };

export function useGraveyard(active = true): GraveyardHandle {
  const [state, setState] = useState<GraveyardHandle>({ graves: null, error: null });
  useEffect(() => {
    if (!active) return;
    let live = true;
    void fetchGraveyard((url, init) => fetch(url, init)).then((r) => {
      if (live) setState('error' in r ? { graves: null, error: r.error } : { graves: r.graves, error: null });
    });
    return () => {
      live = false;
    };
  }, [active]);
  return state;
}

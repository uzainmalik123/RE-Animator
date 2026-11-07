import { useEffect, useState } from 'react';
import type { Headstone } from '../../shared/graveyard';
import { fetchGraveyard } from './graveyardClient';

// The graves to choose from, loaded once: `graves` is null until the backend has answered.
export type GraveyardHandle = { graves: Headstone[] | null; error: string | null };

export function useGraveyard(): GraveyardHandle {
  const [state, setState] = useState<GraveyardHandle>({ graves: null, error: null });
  useEffect(() => {
    let live = true;
    void fetchGraveyard((url, init) => fetch(url, init)).then((r) => {
      if (live) setState('error' in r ? { graves: null, error: r.error } : { graves: r.graves, error: null });
    });
    return () => {
      live = false;
    };
  }, []);
  return state;
}

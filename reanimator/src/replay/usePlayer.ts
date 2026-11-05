import { useEffect, useMemo, useState } from 'react';
import type { RecordedLine } from '../../shared/recording';
import { EMPTY_SESSION, advance, schedule, type Position, type Session } from './timeline';

export type Speed = 1 | 2 | 4;
export const SPEEDS: Speed[] = [1, 2, 4];

export type Player = { session: Session; n: number; total: number; playing: boolean; speed: Speed; toggle(): void; setSpeed(s: Speed): void; restart(): void };

const START: Position = { n: 0, session: EMPTY_SESSION };
const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// R11: play a recording on its (shortened) real clock. One timer to the next line at a time; with
// reduced motion it waits for Play.
export function usePlayer(lines: RecordedLine[]): Player {
  const times = useMemo(() => schedule(lines), [lines]);
  const [pos, setPos] = useState<Position>(START);
  const [playing, setPlaying] = useState(() => !reducedMotion());
  const [speed, setSpeed] = useState<Speed>(1);

  useEffect(() => {
    if (!playing || pos.n >= lines.length) return;
    const wait = pos.n === 0 ? 0 : (times[pos.n]! - times[pos.n - 1]!) / speed;
    const id = setTimeout(() => setPos((p) => advance(p, lines, times)), wait);
    return () => clearTimeout(id);
  }, [playing, pos.n, speed, lines, times]);

  return {
    session: pos.session,
    n: pos.n,
    total: lines.length,
    playing,
    speed,
    toggle: () => setPlaying((x) => !x),
    setSpeed,
    restart: () => {
      setPos(START);
      setPlaying(true);
    },
  };
}

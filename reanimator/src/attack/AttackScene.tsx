import { useLayoutEffect, useRef, useState } from 'react';
import type { AttackState } from '../../shared/attack';
import { sampleLuminance } from '../render';
import { useDotCanvas } from '../render/useDotCanvas';
import { containRect } from '../render/viewport';
import { frameUrl } from './attackClient';
import { arrival, bodyLuminance, bodyRect, deathLayer, deathRect, idleSpot, memoByKey, placeOnBody, sceneLabel, watchedGhost, woundPoints, type Minion, type Rect } from './scene';
import { useImage, useSize } from './useImage';

const DEATH_ART = '/art/death.svg';
const MAX_MINIONS = 12;
const ARRIVED = 0.6;
const LINGER = 0.35;

// The body (the frame) inside a cols×rows grid; with no frame yet, the whole grid stands in for it,
// so positions still land where the ghost really acted.
const bodyIn = (img: HTMLImageElement | null, cols: number, rows: number): Rect =>
  img ? bodyRect(img.naturalWidth, img.naturalHeight, cols, rows) : { x: 0, y: 0, w: cols, h: rows };

// R4: Death's attack drawn over the app (THEME §5.3, §6). The body is the engine's own latest frame
// of the watched ghost, in bone; Death, his minions and the wounds are one red layer above it. Wound
// labels are real text, placed over the dots.
export function AttackScene({ state, attackId }: { state: AttackState; attackId: string | null }) {
  const stage = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLCanvasElement>(null);
  const deathRef = useRef<HTMLCanvasElement>(null);
  const [summonedAt] = useState(() => (typeof performance === 'undefined' ? 0 : performance.now()));
  const watched = watchedGhost(state);
  const g = watched ? state.ghosts[watched] : undefined;
  const frame = useImage(attackId && g?.frame !== undefined ? frameUrl(attackId, g.ghostId, g.frame) : null);
  const death = useImage(DEATH_ART);
  const size = useSize(stage);
  const [bodyMemo] = useState(() => memoByKey<Float32Array>());
  const [deathMemo] = useState(() => memoByKey<Float32Array>());
  const wounds = woundPoints(state);
  // The red layer's loop reads the latest state through a ref, so a ghost's step doesn't rebuild the
  // canvas; with reduced motion it must redraw its still on every change, so then state is a dep.
  const latest = useRef({ state, wounds });
  useLayoutEffect(() => {
    latest.current = { state, wounds };
  });
  const still = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  useDotCanvas(
    bodyRef,
    'bone',
    (cols, rows) =>
      frame ? bodyMemo(`${frame.src} ${cols}x${rows}`, () => bodyLuminance((w, h) => sampleLuminance(frame, w, h), frame.naturalWidth, frame.naturalHeight, cols, rows)) : new Float32Array(cols * rows),
    [frame],
  );

  useDotCanvas(
    deathRef,
    'death',
    (cols, rows, t, reduce) => {
      const { state: s, wounds: ws } = latest.current;
      const body = bodyIn(frame, cols, rows);
      const dr = deathRect(cols, rows);
      const deathLum = death ? deathMemo(`${dr.w}x${dr.h}`, () => sampleLuminance(death, dr.w, dr.h)) : null;
      const live = s.status === 'attacking' ? Object.values(s.ghosts).filter((x) => !x.done).slice(0, MAX_MINIONS) : [];
      const minions: Minion[] = live.map((m, i) => {
        if (m.x === undefined || m.y === undefined) return { ...idleSpot(i, cols, rows), persona: m.persona, trail: [] };
        const trail = reduce ? [] : m.trail.map((p) => placeOnBody(body, m.persona, p.x, p.y));
        return { ...placeOnBody(body, m.persona, m.x, m.y), persona: m.persona, trail };
      });
      const cells = ws.map((w) => ({ col: body.x + Math.min(body.w - 1, Math.floor(w.fx * body.w)), row: body.y + Math.min(body.h - 1, Math.floor(w.fy * body.h)) }));
      const strength = s.status === 'attacking' ? ARRIVED * arrival(t, summonedAt, reduce) : LINGER;
      return deathLayer(cols, rows, { strength, minions, wounds: cells, death: deathLum, deathRect: deathLum ? dr : null });
    },
    [frame, death, still ? state : state.status],
  );

  // The labels sit on the same body fractions, in CSS space (the frame is letterboxed in the stage).
  const box = frame && size.w > 0 ? containRect(frame.naturalWidth, frame.naturalHeight, size.w, size.h) : null;
  const pct = (f: number, axis: 'x' | 'y') => {
    if (!box) return f * 100;
    return axis === 'x' ? ((box.x + f * box.w) / size.w) * 100 : ((box.y + f * box.h) / size.h) * 100;
  };

  return (
    <div ref={stage} className="attack-stage" role="img" aria-label={sceneLabel(state)}>
      <canvas ref={bodyRef} className="attack-body" />
      <canvas ref={deathRef} className="attack-death" />
      <ol className="attack-wounds" aria-hidden="true">
        {wounds.map((w) => (
          <li key={w.key} style={{ left: `${Math.round(pct(w.fx, 'x'))}%`, top: `${Math.round(pct(w.fy, 'y'))}%` }}>
            {w.label}
          </li>
        ))}
      </ol>
    </div>
  );
}

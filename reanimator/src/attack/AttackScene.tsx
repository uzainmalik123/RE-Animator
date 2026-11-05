import { useRef, useState } from 'react';
import type { AttackState } from '../../shared/attack';
import { sampleLuminance } from '../render';
import { useDotCanvas } from '../render/useDotCanvas';
import { containRect } from '../render/viewport';
import { frameUrl } from './attackClient';
import { arrival, bodyRect, deathLayer, deathRect, idleSpot, placeOnBody, sceneLabel, watchedGhost, woundPoints, type Minion, type Rect } from './scene';
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
  const deathCache = useRef<{ key: string; lum: Float32Array } | null>(null);
  const wounds = woundPoints(state);

  useDotCanvas(
    bodyRef,
    'bone',
    (cols, rows) => {
      const out = new Float32Array(cols * rows);
      if (!frame || cols === 0 || rows === 0) return out;
      const b = bodyIn(frame, cols, rows);
      const lum = sampleLuminance(frame, b.w, b.h);
      for (let y = 0; y < b.h; y++) out.set(lum.subarray(y * b.w, (y + 1) * b.w), (b.y + y) * cols + b.x);
      return out;
    },
    [frame],
  );

  useDotCanvas(
    deathRef,
    'death',
    (cols, rows, t, still) => {
      const body = bodyIn(frame, cols, rows);
      const dr = deathRect(cols, rows);
      const key = `${dr.w}x${dr.h}`;
      if (death && deathCache.current?.key !== key) deathCache.current = { key, lum: sampleLuminance(death, dr.w, dr.h) };
      const live = state.status === 'attacking' ? Object.values(state.ghosts).filter((x) => !x.done).slice(0, MAX_MINIONS) : [];
      const minions: Minion[] = live.map((m, i) => {
        if (m.x === undefined || m.y === undefined) return { ...idleSpot(i, cols, rows), persona: m.persona, trail: [] };
        const trail = still ? [] : m.trail.map((p) => placeOnBody(body, m.persona, p.x, p.y));
        return { ...placeOnBody(body, m.persona, m.x, m.y), persona: m.persona, trail };
      });
      const cells = wounds.map((w) => ({ col: body.x + Math.min(body.w - 1, Math.floor(w.fx * body.w)), row: body.y + Math.min(body.h - 1, Math.floor(w.fy * body.h)) }));
      const strength = state.status === 'attacking' ? ARRIVED * arrival(t, summonedAt, still) : LINGER;
      return deathLayer(cols, rows, { strength, minions, wounds: cells, death: death ? deathCache.current!.lum : null, deathRect: death ? dr : null });
    },
    [state, frame, death],
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

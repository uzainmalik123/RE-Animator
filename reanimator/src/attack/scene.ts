// The attack scene's imagery (R4, THEME §5.3, §6) as luminance grids and cell positions for the R1
// renderer: pure maths, deterministic for the same arguments. Everything drawn follows real engine
// facts (D-R11): a minion sits where its ghost last acted, a wound only where a haunted pair's ghost
// was, and the body is only ever a frame the engine captured.
import type { AttackState, Ghost, Wound } from '../../shared/attack';
import { containRect } from '../render/viewport';

export type Rect = { x: number; y: number; w: number; h: number };
type Cell = { col: number; row: number };

// The engine's viewports (Poltergeist personas/devices.ts and Playwright's default), restated here
// because Reanimator never imports the engine (D-R16, KI-R17).
export const VIEWPORTS: Record<string, { width: number; height: number }> = { lich: { width: 360, height: 640 } };
export const DEFAULT_VIEWPORT = { width: 1280, height: 720 };
export const viewportOf = (persona: string) => VIEWPORTS[persona] ?? DEFAULT_VIEWPORT;

// THEME §6's drafts, one per Poltergeist persona. Only their shape matters: they're drawn as dots.
export const MINION_SPRITES: Record<string, string[]> = {
  wraith: [' .-. ', '(>‿<)', '/|×|\\', ' ^ ^ '],
  banshee: [' .-. ', '(O□O)', '\\|!|/', ' ^^^ '],
  doppelganger: [' .-.  .-. ', '(o o)(o o)', ' |~|  |~| ', ' ^^    ^^ '],
  lich: ['_.-._', '(x_x)', ' |▓▓|', ' ^^^^'],
  revenant: [' .-. ', '(- -)', ' |..|>', ' ^^^^'],
  changeling: [' .-. ', '(⌐ ⌐)', ' |[]|', ' ^^^^'],
};

export function spriteLuminance(lines: string[]): { cols: number; rows: number; lum: Float32Array } {
  const rows = lines.length;
  const chars = lines.map((l) => [...l]);
  const cols = Math.max(0, ...chars.map((c) => c.length));
  const lum = new Float32Array(cols * rows);
  chars.forEach((c, y) => c.forEach((ch, x) => (lum[y * cols + x] = ch === ' ' ? 0 : 1)));
  return { cols, rows, lum };
}

const SPRITES = Object.fromEntries(Object.entries(MINION_SPRITES).map(([k, v]) => [k, spriteLuminance(v)]));
const spriteOf = (persona: string) => SPRITES[persona] ?? SPRITES.wraith!;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// A ghost's viewport px → a cell on the body (where its frame is drawn), clamped inside it.
export function placeOnBody(body: Rect, persona: string, x: number, y: number): Cell {
  const vp = viewportOf(persona);
  return {
    col: clamp(body.x + Math.floor((x / vp.width) * body.w), body.x, body.x + body.w - 1),
    row: clamp(body.y + Math.floor((y / vp.height) * body.h), body.y, body.y + body.h - 1),
  };
}

const IDLE_SLOTS = 12;

// Where the i-th ghost with no position yet waits: a fixed slot along the bottom edge.
export function idleSpot(i: number, cols: number, rows: number): Cell {
  return { col: Math.floor((((i % IDLE_SLOTS) + 0.5) / IDLE_SLOTS) * cols), row: Math.max(0, rows - 4) };
}

const round = (r: Rect): Rect => ({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) });

// The engine frame, fitted whole into the grid.
export const bodyRect = (frameW: number, frameH: number, cols: number, rows: number): Rect => round(containRect(frameW, frameH, cols, rows));

const DEATH_ART = { width: 240, height: 360 };

// Death looms in the top-centre: a third of the width, most of the height.
export function deathRect(cols: number, rows: number): Rect {
  const r = containRect(DEATH_ART.width, DEATH_ART.height, cols / 3, rows * 0.7);
  return round({ x: cols / 3 + r.x, y: 0, w: r.w, h: r.h });
}

// The ghost the body follows: the earliest running one with a frame; after the attack, the first
// wound's ghost (its evidence), else the last ghost seen.
export function watchedGhost(s: AttackState): string | null {
  const framed = Object.values(s.ghosts).filter((g) => g.frame !== undefined);
  if (s.status === 'attacking') return framed.find((g) => !g.done)?.ghostId ?? framed.at(-1)?.ghostId ?? null;
  if (s.status === 'idle') return null;
  const w = s.wounds[0];
  const evidence = w ? framed.filter((g) => g.criterion === w.criterion && g.persona === w.persona).at(-1) : undefined;
  return (evidence ?? framed.at(-1))?.ghostId ?? null;
}

// Where a wound opens: the last position of a ghost of its pair, the latest rep winning.
export function woundSpot(w: Wound, s: AttackState): { x: number; y: number; persona: string } | null {
  let best: Ghost | null = null;
  for (const g of Object.values(s.ghosts)) {
    if (g.criterion !== w.criterion || g.persona !== w.persona || g.x === undefined || g.y === undefined) continue;
    if (!best || g.rep >= best.rep) best = g;
  }
  return best ? { x: best.x!, y: best.y!, persona: best.persona } : null;
}

const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// Death bleeding in from the edges: 0 in the middle, `strength` at the border.
export function vignetteLuminance(cols: number, rows: number, strength: number): Float32Array {
  const out = new Float32Array(cols * rows);
  if (cols === 0 || rows === 0 || strength <= 0) return out;
  for (let y = 0; y < rows; y++) {
    const v = rows > 1 ? Math.abs((2 * y) / (rows - 1) - 1) : 0;
    for (let x = 0; x < cols; x++) {
      const u = cols > 1 ? Math.abs((2 * x) / (cols - 1) - 1) : 0;
      out[y * cols + x] = strength * smoothstep(0.55, 1, Math.max(u, v));
    }
  }
  return out;
}

const TRAIL_FADE = [0.5, 0.3, 0.15];

// Max-composites `lum` (w×h) at (x0, y0), times `k`, clipped to the grid.
function stamp(out: Float32Array, cols: number, rows: number, lum: Float32Array, w: number, h: number, x0: number, y0: number, k: number) {
  for (let y = 0; y < h; y++) {
    const gy = y0 + y;
    if (gy < 0 || gy >= rows) continue;
    for (let x = 0; x < w; x++) {
      const gx = x0 + x;
      if (gx < 0 || gx >= cols) continue;
      const v = lum[y * w + x]! * k;
      if (v > out[gy * cols + gx]!) out[gy * cols + gx] = v;
    }
  }
}

// A wound: a jagged 9×3 gash, ▓ in the middle, ▒ then ░ toward its ends (as brightness steps).
const GASH = (() => {
  const w = 9;
  const lum = new Float32Array(w * 3);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      if (dy !== 0 && (dx + dy) % 2 !== 0) continue;
      const a = Math.abs(dx);
      lum[(dy + 1) * w + dx + 4] = a <= 1 ? 1 : a <= 3 ? 0.66 : 0.33;
    }
  }
  return { w, h: 3, lum };
})();

export type Minion = { col: number; row: number; persona: string; trail: Cell[] };

// Everything in Death's red, as one grid: the vignette, Death himself, his minions (with fading
// trails) and the wounds.
export function deathLayer(
  cols: number,
  rows: number,
  o: { strength: number; minions: Minion[]; wounds: Cell[]; death: Float32Array | null; deathRect: Rect | null },
): Float32Array {
  const out = vignetteLuminance(cols, rows, o.strength);
  if (cols === 0 || rows === 0) return out;
  if (o.death && o.deathRect) stamp(out, cols, rows, o.death, o.deathRect.w, o.deathRect.h, o.deathRect.x, o.deathRect.y, 1);
  for (const m of o.minions) {
    const sp = spriteOf(m.persona);
    const at = (c: Cell, k: number) => stamp(out, cols, rows, sp.lum, sp.cols, sp.rows, c.col - (sp.cols >> 1), c.row - (sp.rows >> 1), k);
    [...m.trail].reverse().forEach((c, i) => at(c, TRAIL_FADE[i] ?? 0));
    at(m, 1);
  }
  for (const w of o.wounds) stamp(out, cols, rows, GASH.lum, GASH.w, GASH.h, w.col - 4, w.row - 1, 1);
  return out;
}

export const ATTACK_RAMP_MS = 1500;

// How far Death has arrived (0..1), `startMs` after he was summoned; at once for reduced motion.
export function arrival(tMs: number, startMs: number, reduceMotion: boolean): number {
  return reduceMotion ? 1 : clamp((tMs - startMs) / ATTACK_RAMP_MS, 0, 1);
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

// The scene's text alternative (THEME §9).
export function sceneLabel(s: AttackState): string {
  if (s.status === 'idle') return 'Death waits';
  if (s.status === 'failed') return 'Death faltered';
  const live = s.status === 'finished' ? 0 : Object.values(s.ghosts).filter((g) => !g.done).length;
  return `Death ${s.status === 'finished' ? 'attacked' : 'attacks'}: ${plural(live, 'minion')}, ${plural(s.wounds.length, 'wound')}`;
}

export type WoundPoint = { key: string; label: string; fx: number; fy: number };

// Each wound's spot as a fraction of the body (0..1 across the frame), shared by the dots and the
// real-text labels. A wound whose minion never reported a position gets a fixed slot on the right, by
// its place in the list.
export function woundPoints(s: AttackState): WoundPoint[] {
  return s.wounds.map((w, i) => {
    const key = `${w.criterion}-${w.persona}`;
    const label = `${w.criterion} · ${w.persona}`;
    const spot = woundSpot(w, s);
    if (spot) {
      const vp = viewportOf(spot.persona);
      return { key, label, fx: clamp(spot.x / vp.width, 0, 1), fy: clamp(spot.y / vp.height, 0, 1) };
    }
    return { key, label, fx: 0.85, fy: Math.min(0.95, Math.round((0.15 + 0.12 * i) * 100) / 100) };
  });
}

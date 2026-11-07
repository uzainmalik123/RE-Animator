// The graveyard's imagery (R6, THEME §5.1) as luminance grids for the R1 renderer: pure maths, no
// canvas, deterministic for the same arguments. Brightness only follows real state (which stone was
// chosen); time only drifts the fog and bobs Kiro. Two grids, two inks (THEME §4): the stones and
// fog in --bone, Kiro in --magic.

export const WALK_MS = 1200;

const MARGIN = 0.18;
const KIRO_HOME = 0.06;
const GROUND = 0.82;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// Where the n headstones stand, as fractions (0..1) of the width: evenly spread between margins;
// a lone stone stands in the middle.
export function slotX(i: number, n: number): number {
  if (n <= 1) return 0.5;
  return MARGIN + ((1 - 2 * MARGIN) * clamp(i, 0, n - 1)) / (n - 1);
}

// How far along the walk Kiro is (0 at the start, 1 on arrival), eased at both ends.
export function walkProgress(elapsedMs: number): number {
  const t = clamp01(elapsedMs / WALK_MS);
  return t * t * (3 - 2 * t);
}

interface Layout {
  groundY: number;
  halfW: number;
  height: number;
}

function layout(cols: number, rows: number, n: number): Layout {
  // A stone never gets wider than the room between two neighbours.
  const room = n > 1 ? ((1 - 2 * MARGIN) * cols) / (n - 1) : cols;
  return {
    groundY: Math.floor(rows * GROUND),
    halfW: clamp(Math.min(Math.round(cols * 0.05), Math.floor(room * 0.4)), 2, 14),
    height: clamp(Math.round(rows * 0.4), 5, 40),
  };
}

// The headstones on the ground in drifting fog. `chosen` (an index into the n stones) burns brighter.
export function stonesLuminance(cols: number, rows: number, o: { tMs: number; n: number; chosen: number | null }): Float32Array {
  const out = new Float32Array(cols * rows);
  if (cols === 0 || rows === 0) return out;
  const { groundY, halfW, height } = layout(cols, rows, o.n);

  // Fog: two slow bands drifting sideways, thickest just above the ground.
  for (let y = 0; y < rows; y++) {
    const near = clamp01(1 - Math.abs(y - (groundY - height * 0.25)) / (height * 0.9));
    if (near === 0) continue;
    for (let x = 0; x < cols; x++) {
      const drift = 0.5 + 0.25 * Math.sin(x * 0.11 + o.tMs * 0.00018 + y * 0.35) + 0.25 * Math.sin(x * 0.047 - o.tMs * 0.00011 + y * 0.9);
      out[y * cols + x] = 0.16 * near * drift;
    }
  }

  // The ground: a bright line with a faint, grainy earth under it.
  for (let y = groundY; y < rows; y++) {
    for (let x = 0; x < cols; x++) out[y * cols + x] = y === groundY ? 0.55 : 0.12 + 0.06 * Math.sin(x * 1.7 + y * 2.3);
  }

  // The stones: a rounded top, an outline, a dim fill and two etched lines (the name, unread).
  for (let i = 0; i < o.n; i++) {
    const cx = Math.round(slotX(i, o.n) * (cols - 1));
    const lit = i === o.chosen;
    const top = groundY - height;
    for (let y = Math.max(0, top); y < groundY; y++) {
      for (let x = Math.max(0, cx - halfW); x <= Math.min(cols - 1, cx + halfW); x++) {
        const dx = x - cx;
        const arcY = top + halfW;
        const inside = y >= arcY ? Math.abs(dx) <= halfW : dx * dx + (y - arcY) * (y - arcY) <= halfW * halfW;
        if (!inside) continue;
        const edge = Math.abs(dx) >= halfW - 0.5 || y === top || (y < arcY && dx * dx + (y - arcY) * (y - arcY) >= (halfW - 1) * (halfW - 1));
        const etched = (y === top + halfW + 2 || y === top + halfW + 4) && Math.abs(dx) <= halfW - 2;
        out[y * cols + x] = edge ? (lit ? 1 : 0.8) : etched ? (lit ? 0.9 : 0.55) : lit ? 0.5 : 0.28;
      }
    }
  }
  return out;
}

// Kiro, the familiar: a soft spirit that bobs at the left edge while it waits (`target` null) and,
// once a stone is chosen, glides to stand beside it, trailing a fading tail while it moves.
// `walkMs` is how long ago the choice was made.
export function kiroLuminance(cols: number, rows: number, o: { tMs: number; n: number; target: number | null; walkMs: number }): Float32Array {
  const out = new Float32Array(cols * rows);
  if (cols === 0 || rows === 0) return out;
  const { groundY, halfW, height } = layout(cols, rows, o.n);
  const radius = clamp(Math.round(rows * 0.06), 2, 6);
  const home = KIRO_HOME * (cols - 1);
  const goal = o.target === null ? home : Math.round(slotX(o.target, o.n) * (cols - 1)) - halfW - radius - 1;
  const p = o.target === null ? 0 : walkProgress(o.walkMs);
  const x0 = home + (goal - home) * p;
  const moving = p > 0 && p < 1;
  const baseY = groundY - Math.round(height * 0.3);
  const bob = (a: number) => a * Math.sin(o.tMs * 0.003);
  const y0 = baseY + bob(radius * 0.5);

  const dab = (cx: number, cy: number, r: number, gain: number) => {
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(rows - 1, Math.ceil(cy + r)); y++) {
      for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(cols - 1, Math.ceil(cx + r)); x++) {
        const v = gain * clamp01(1 - Math.hypot(x - cx, y - cy) / r);
        if (v > out[y * cols + x]!) out[y * cols + x] = v;
      }
    }
  };
  if (moving) for (let k = 1; k <= 6; k++) dab(x0 - k * radius * 0.9, y0 + bob(radius * 0.3 * k), radius * (1 - k / 8), 0.7 * (1 - k / 7));
  dab(x0, y0, radius, 1);
  return out;
}

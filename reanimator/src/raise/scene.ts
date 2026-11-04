// The raise scene's imagery (R2, THEME §5.2) as luminance grids for the R1 renderer: pure maths,
// no canvas, deterministic for the same arguments. Brightness only ever follows real ritual state
// (power = beats passed, beating = vitals passed); time only spins or scrolls what is already lit.

const SPIN_RAD_PER_MS = 0.0004;
const SPOKES = 8;

// Anti-aliased band: 1 on the line, falling to 0 at `width` cells away.
const band = (dist: number, width: number) => Math.max(0, 1 - Math.abs(dist) / width);

// The spell circle: two outer rings, a fainter inner ring, and rune spokes between the outer rings,
// turning slowly. `power` (0..1) sets how brightly it burns.
export function circleLuminance(cols: number, rows: number, o: { tMs: number; power: number }): Float32Array {
  const out = new Float32Array(cols * rows);
  if (cols === 0 || rows === 0) return out;
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;
  const R = 0.46 * Math.min(cols, rows);
  const glow = Math.min(1, 0.35 + 0.65 * Math.max(0, Math.min(1, o.power)));
  const spin = o.tMs * SPIN_RAD_PER_MS;
  const outer = R;
  const mid = 0.8 * R;
  const inner = 0.5 * R;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.hypot(dx, dy);
      let v = Math.max(band(d - outer, 1.1), band(d - mid, 1.1), 0.5 * band(d - inner, 0.9));
      if (d > mid && d < outer) {
        // Distance (in cells) from the nearest rotating spoke.
        const sector = (2 * Math.PI) / SPOKES;
        const a = Math.atan2(dy, dx) - spin;
        const off = a - sector * Math.round(a / sector);
        v = Math.max(v, 0.8 * band(off * d, 0.9));
      }
      out[y * cols + x] = v * glow;
    }
  }
  return out;
}

const BEAT_MS = 1000;
const BEATS_ACROSS = 2;

// The heart-beat shape over one period (0..1): a small P bump, the tall QRS spike, a T bump.
function beatHeight(u: number): number {
  return 0.15 * band(u - 0.2, 0.05) + band(u - 0.45, 0.04) - 0.35 * band(u - 0.5, 0.03) + 0.25 * band(u - 0.7, 0.06);
}

// The heart monitor: a flat line through the middle row (flatline), or a trace that beats and
// scrolls left with time. Consecutive columns are joined so the spike stays one unbroken line.
export function monitorLuminance(cols: number, rows: number, o: { tMs: number; beating: boolean }): Float32Array {
  const out = new Float32Array(cols * rows);
  if (cols === 0 || rows === 0) return out;
  const midRow = Math.floor(rows / 2);
  const amp = 0.45 * rows;
  let prev: number | null = null;
  for (let x = 0; x < cols; x++) {
    let row = midRow;
    if (o.beating) {
      const u = (((x / cols) * BEATS_ACROSS + o.tMs / BEAT_MS) % 1 + 1) % 1;
      row = Math.max(0, Math.min(rows - 1, midRow - Math.round(beatHeight(u) * amp)));
    }
    const from = prev === null ? row : Math.min(prev, row);
    const to = prev === null ? row : Math.max(prev, row);
    for (let y = from; y <= to; y++) out[y * cols + x] = 1;
    prev = row;
  }
  return out;
}

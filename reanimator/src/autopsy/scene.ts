// The autopsy slab (R8, THEME §5): a body lying on a slab with a light scanning along it, as a luminance
// grid for the R1 renderer. Pure maths, deterministic for the same arguments. It is costume only:
// time moves the scan light, and the only state it reflects is how many causes were really found
// (one lit mark each, D-R11). It never says what they are.

export const MAX_MARKS = 12;
const SWEEP_MS = 3600;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const band = (dist: number, width: number) => Math.max(0, 1 - Math.abs(dist) / width);

export function slabLuminance(cols: number, rows: number, o: { tMs: number; causes: number }): Float32Array {
  const out = new Float32Array(cols * rows);
  if (cols === 0 || rows === 0) return out;
  const put = (x: number, y: number, v: number) => {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || iy < 0 || ix >= cols || iy >= rows) return;
    out[iy * cols + ix] = Math.max(out[iy * cols + ix]!, clamp01(v));
  };

  const slabY = rows * 0.7;
  const left = cols * 0.06;
  const right = cols * 0.94;
  const bodyY = slabY - Math.max(1, rows * 0.16);
  const bodyL = cols * 0.16;
  const bodyR = cols * 0.84;
  const headR = Math.max(1, rows * 0.14);

  // The slab: a top edge and a leg at each end.
  for (let x = left; x <= right; x++) put(x, slabY, 0.4);
  for (let y = slabY; y < rows; y++) {
    put(left + 1, y, 0.22);
    put(right - 1, y, 0.22);
  }

  // The body: a head and a long shape lying down, thicker at the chest.
  for (let x = bodyL; x <= bodyR; x++) {
    const t = (x - bodyL) / Math.max(1, bodyR - bodyL);
    const thick = Math.max(0.6, Math.sin(Math.PI * clamp01(t)) * rows * 0.1);
    for (let y = bodyY - thick; y <= bodyY + thick; y++) put(x, y, 0.28 + 0.1 * (1 - Math.abs(y - bodyY) / (thick + 0.5)));
  }
  for (let a = 0; a < 24; a++) put(bodyL - headR - 1 + Math.cos((a / 24) * 2 * Math.PI) * headR, bodyY + Math.sin((a / 24) * 2 * Math.PI) * headR, 0.45);

  // The scan light sweeps from head to feet and back, lighting the column it crosses.
  const phase = (o.tMs % (2 * SWEEP_MS)) / SWEEP_MS;
  const sweep = phase <= 1 ? phase : 2 - phase;
  const sx = left + (right - left) * sweep;
  for (let x = Math.floor(sx - 2); x <= Math.ceil(sx + 2); x++) {
    const glow = band(x - sx, 2.2);
    for (let y = rows * 0.12; y <= slabY; y++) put(x, y, 0.15 + 0.85 * glow * (0.5 + 0.5 * band(y - bodyY, rows * 0.45)));
  }

  // One lit mark per real cause, evenly along the body.
  const n = Math.min(MAX_MARKS, Math.max(0, Math.floor(o.causes)));
  for (let i = 0; i < n; i++) {
    const x = bodyL + ((bodyR - bodyL) * (i + 1)) / (n + 1);
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const) put(x + dx, bodyY + dy, dx === 0 && dy === 0 ? 1 : 0.7);
  }
  return out;
}

// The pure heart of the dot-matrix look (THEME §3): luminance per cell, then a 4x4 Bayer ordered
// dither into a few brightness steps. No canvas here, so it runs (and is snapshot-tested) in node.

// 4x4 Bayer matrix; a cell's threshold is (v + 0.5) / 16.
export const BAYER4: readonly number[] = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

// Glyph ramp, dark to light (THEME §7). Index 0 is a space: darkness is empty.
export const GLYPH_RAMP = ' .:-=+*#%@';

const DEFAULT_GAMMA = 1.2;

// How many whole cells of `pitch` fit; zero for anything that isn't a positive finite size.
export function gridSize(width: number, height: number, pitch: number): { cols: number; rows: number } {
  const ok = (n: number) => Number.isFinite(n) && n > 0;
  if (!ok(width) || !ok(height) || !ok(pitch)) return { cols: 0, rows: 0 };
  return { cols: Math.floor(width / pitch), rows: Math.floor(height / pitch) };
}

// Rec. 709 luminance of each RGBA pixel (one pixel per cell), alpha-weighted so transparency is
// dark, then lifted by gamma so mid-tones don't wash out.
export function luminanceGrid(rgba: Uint8ClampedArray, cols: number, rows: number, gamma = DEFAULT_GAMMA): Float32Array {
  const out = new Float32Array(cols * rows);
  for (let i = 0; i < out.length; i++) {
    const p = i * 4;
    const lum = (0.2126 * rgba[p]! + 0.7152 * rgba[p + 1]! + 0.0722 * rgba[p + 2]!) / 255;
    out[i] = (lum * (rgba[p + 3]! / 255)) ** gamma;
  }
  return out;
}

// Quantise each cell to 0..steps-1 with the Bayer threshold added, so the texture is stable.
// Level 0 means "draw nothing". NaN counts as dark; values outside 0..1 clamp.
export function ditherLevels(lum: Float32Array, cols: number, rows: number, steps: number): Uint8Array {
  const out = new Uint8Array(cols * rows);
  const top = Math.max(1, Math.floor(steps)) - 1;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = row * cols + col;
      const l = lum[i]!;
      const v = Number.isFinite(l) ? Math.min(Math.max(l, 0), 1) : 0;
      const t = (BAYER4[(row & 3) * 4 + (col & 3)]! + 0.5) / 16;
      out[i] = Math.min(top, Math.floor(v * top + t));
    }
  }
  return out;
}

// One character per cell (level i → ramp[i]), rows joined by newlines.
export function levelsToText(levels: Uint8Array, cols: number, ramp: string = GLYPH_RAMP): string {
  const lines: string[] = [];
  for (let start = 0; start < levels.length; start += cols) {
    let line = '';
    for (let i = start; i < start + cols; i++) line += ramp[levels[i]!] ?? ramp[ramp.length - 1];
    lines.push(line);
  }
  return lines.join('\n');
}

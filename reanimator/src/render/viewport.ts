// Small pure helpers for putting the renderer on a real screen (THEME §3 "Responsiveness", §4).

// Dot pitch in CSS px from the viewport width: finer dots on phones, coarser on desktop.
export function pitchFor(cssWidth: number): number {
  return cssWidth < 640 ? 2 : 3;
}

const BREATH_MS = 4000;
const BREATH_DEPTH = 0.15;

// A slow brightness multiplier for idle scenes: 1 at rest, dipping to 0.85 halfway through 4 s.
export function breath(tMs: number): number {
  return 1 - (BREATH_DEPTH / 2) * (1 - Math.cos((2 * Math.PI * tMs) / BREATH_MS));
}

// Where to draw a src-sized image inside a dst-sized box so it fits whole and centred ("contain").
export function containRect(srcW: number, srcH: number, dstW: number, dstH: number): { x: number; y: number; w: number; h: number } {
  if (!(srcW > 0 && srcH > 0 && dstW > 0 && dstH > 0)) return { x: 0, y: 0, w: 0, h: 0 };
  const s = Math.min(dstW / srcW, dstH / srcH);
  const w = srcW * s;
  const h = srcH * s;
  return { x: (dstW - w) / 2, y: (dstH - h) / 2, w, h };
}

const FALLBACK = { magic: '#b98cff', void: '#06060a', death: '#ff3b4e', bone: '#cfc8b8' };

export type ScenePalette = typeof FALLBACK;

// The palette tokens the scenes need, read from CSS (THEME §4), with the THEME values as fallback.
export function readPalette(el: Element): ScenePalette {
  const css = getComputedStyle(el);
  const read = (k: keyof ScenePalette) => css.getPropertyValue(`--${k}`).trim() || FALLBACK[k];
  return { magic: read('magic'), void: read('void'), death: read('death'), bone: read('bone') };
}

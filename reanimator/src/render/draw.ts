// Thin canvas painters over the pure dither core (THEME §3 step 5, §7). Everything is laid out in
// CSS px and multiplied by `scale` (the devicePixelRatio) so the dots stay crisp on dense screens.
import { ditherLevels, GLYPH_RAMP, gridSize, luminanceGrid } from './dither';

export type Palette = { ink: string; background?: string };

export type DotOptions = {
  pitch: number;
  palette: Palette;
  steps?: number;
  gap?: number;
  shape?: 'circle' | 'square';
  scale?: number;
};

export type GlyphOptions = {
  pitch: number;
  palette: Palette;
  scale?: number;
  ramp?: string;
  font?: string;
};

export type Ctx = Pick<
  CanvasRenderingContext2D,
  'canvas' | 'fillStyle' | 'fillRect' | 'clearRect' | 'beginPath' | 'arc' | 'fill' | 'fillText' | 'font' | 'textAlign' | 'textBaseline'
>;

export type ResolvedDotOptions = Required<Omit<DotOptions, 'palette'>> & { palette: Palette };

export const DEFAULT_DOT_STEPS = 4;
const GLYPH_FONT = "'JetBrains Mono', monospace";

export function resolveDotOptions(o: DotOptions): ResolvedDotOptions {
  return { steps: DEFAULT_DOT_STEPS, gap: 1, shape: 'circle', scale: 1, ...o };
}

// Paint the whole area with the background, or clear it if there is none.
export function fillBackground(ctx: Ctx, x: number, y: number, w: number, h: number, palette: Palette): void {
  if (palette.background) {
    ctx.fillStyle = palette.background;
    ctx.fillRect(x, y, w, h);
  } else {
    ctx.clearRect(x, y, w, h);
  }
}

// One dot at (col, row). Level 0 paints nothing; brighter levels paint bigger dots.
// The caller sets fillStyle to the ink first.
export function paintDot(ctx: Ctx, col: number, row: number, level: number, o: ResolvedDotOptions): void {
  if (level <= 0) return;
  const cell = o.pitch * o.scale;
  const size = o.steps > 1 ? 0.4 + (0.6 * level) / (o.steps - 1) : 1;
  const r = (Math.max(o.pitch - o.gap, 0) / 2) * size * o.scale;
  const cx = col * cell + cell / 2;
  const cy = row * cell + cell / 2;
  if (o.shape === 'square') {
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  } else {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawLevelsAsDots(ctx: Ctx, levels: Uint8Array, cols: number, rows: number, options: DotOptions): number {
  const o = resolveDotOptions(options);
  const cell = o.pitch * o.scale;
  fillBackground(ctx, 0, 0, cols * cell, rows * cell, o.palette);
  ctx.fillStyle = o.palette.ink;
  let drawn = 0;
  for (let i = 0; i < levels.length; i++) {
    if (levels[i]! === 0) continue;
    paintDot(ctx, i % cols, Math.floor(i / cols), levels[i]!, o);
    drawn++;
  }
  return drawn;
}

export function drawLevelsAsGlyphs(ctx: Ctx, levels: Uint8Array, cols: number, rows: number, options: GlyphOptions): number {
  const scale = options.scale ?? 1;
  const ramp = options.ramp ?? GLYPH_RAMP;
  const cell = options.pitch * scale;
  fillBackground(ctx, 0, 0, cols * cell, rows * cell, options.palette);
  ctx.fillStyle = options.palette.ink;
  ctx.font = `${cell}px ${options.font ?? GLYPH_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let drawn = 0;
  for (let i = 0; i < levels.length; i++) {
    const ch = ramp[levels[i]!];
    if (!ch || ch === ' ') continue;
    ctx.fillText(ch, (i % cols) * cell + cell / 2, Math.floor(i / cols) * cell + cell / 2);
    drawn++;
  }
  return drawn;
}

// Browser only: shrink the image to one pixel per cell (the browser area-averages) and read its
// luminance. Not unit-tested; the pure parts it feeds are.
export function sampleLuminance(image: CanvasImageSource, cols: number, rows: number): Float32Array {
  if (cols === 0 || rows === 0) return new Float32Array(0);
  const small = new OffscreenCanvas(cols, rows);
  const sctx = small.getContext('2d', { willReadFrequently: true });
  if (!sctx) return new Float32Array(cols * rows);
  sctx.drawImage(image, 0, 0, cols, rows);
  return luminanceGrid(sctx.getImageData(0, 0, cols, rows).data, cols, rows);
}

function canvasGrid(ctx: Ctx, pitch: number, scale: number) {
  return gridSize(ctx.canvas.width, ctx.canvas.height, pitch * scale);
}

export function drawDots(ctx: Ctx, image: CanvasImageSource, options: DotOptions): number {
  const o = resolveDotOptions(options);
  const { cols, rows } = canvasGrid(ctx, o.pitch, o.scale);
  return drawLevelsAsDots(ctx, ditherLevels(sampleLuminance(image, cols, rows), cols, rows, o.steps), cols, rows, o);
}

export function drawGlyphs(ctx: Ctx, image: CanvasImageSource, options: GlyphOptions): number {
  const ramp = options.ramp ?? GLYPH_RAMP;
  const { cols, rows } = canvasGrid(ctx, options.pitch, options.scale ?? 1);
  return drawLevelsAsGlyphs(ctx, ditherLevels(sampleLuminance(image, cols, rows), cols, rows, ramp.length), cols, rows, options);
}

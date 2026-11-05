import { useEffect, type RefObject } from 'react';
import { sizeCanvas } from '../canvas';
import { gridSize } from './dither';
import { DotRenderer } from './renderer';
import { pitchFor, readPalette, type ScenePalette } from './viewport';

const FRAME_MS = 1000 / 30;

// Luminance for one frame of a scene; `reduceMotion` frames are stills (tMs is 0).
export type Lum = (cols: number, rows: number, tMs: number, reduceMotion: boolean) => Float32Array;

// One canvas, one ink (THEME §4: never magic and death on the same element), drawn through the R1
// renderer. Animates at 30fps unless the viewer prefers reduced motion; then it draws one still frame
// each time `deps` change. Shared by the raise (R2) and the attack (R4).
export function useDotCanvas(ref: RefObject<HTMLCanvasElement | null>, ink: keyof ScenePalette, lum: Lum, deps: unknown[]) {
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const palette = readPalette(document.documentElement);
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let last = -Infinity;
    let renderer: DotRenderer | null = null;
    let cols = 0;
    let rows = 0;

    const draw = (t: number) => {
      if (renderer && t - last >= FRAME_MS) {
        last = t;
        renderer.renderLuminance(lum(cols, rows, reduceMotion.matches ? 0 : t, reduceMotion.matches), cols, rows);
      }
      if (!reduceMotion.matches) frame = requestAnimationFrame(draw);
    };
    const layout = () => {
      cancelAnimationFrame(frame);
      const dpr = window.devicePixelRatio || 1;
      const size = sizeCanvas(canvas.clientWidth, canvas.clientHeight, dpr);
      canvas.width = size.width;
      canvas.height = size.height;
      ctx.fillStyle = palette.void;
      ctx.fillRect(0, 0, size.width, size.height);
      const pitch = pitchFor(canvas.clientWidth);
      const scale = size.width / Math.max(canvas.clientWidth, 1);
      ({ cols, rows } = gridSize(size.width, size.height, pitch * scale));
      renderer = new DotRenderer(ctx, { pitch, scale, palette: { ink: palette[ink], background: palette.void } });
      last = -Infinity;
      draw(performance.now());
    };
    const resize = new ResizeObserver(layout);
    resize.observe(canvas);
    reduceMotion.addEventListener('change', layout);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      reduceMotion.removeEventListener('change', layout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- redraw only when the scene's state changes
  }, deps);
}

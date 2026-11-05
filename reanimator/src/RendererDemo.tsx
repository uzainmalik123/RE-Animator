import { useEffect, useRef, useState } from 'react';
import { sizeCanvas } from './canvas';
import { DotRenderer, drawLevelsAsGlyphs, ditherLevels, GLYPH_RAMP, gridSize, luminanceGrid } from './render';
import { breath, containRect, pitchFor, readPalette } from './render/viewport';
import { art } from './art';

const SAMPLE_SRC = art('sample-headstone.svg');
const PITCHES = [2, 3, 4, 6] as const;
const GLYPH_PITCH_FACTOR = 4;
const FRAME_MS = 1000 / 30;

type Pitch = 'auto' | (typeof PITCHES)[number];
type Mode = 'dots' | 'glyphs';

// Luminance of the image fitted whole ("contain") into a cols x rows grid, one pixel per cell.
function containedLuminance(img: HTMLImageElement, cols: number, rows: number): Float32Array {
  if (cols === 0 || rows === 0) return new Float32Array(0);
  const small = new OffscreenCanvas(cols, rows);
  const sctx = small.getContext('2d', { willReadFrequently: true });
  if (!sctx) return new Float32Array(cols * rows);
  const r = containRect(img.naturalWidth, img.naturalHeight, cols, rows);
  sctx.drawImage(img, r.x, r.y, r.w, r.h);
  return luminanceGrid(sctx.getImageData(0, 0, cols, rows).data, cols, rows);
}

// R1: the renderer demo. The stage shows our sample art as dot-matrix magic; the panel (real text)
// switches pitch and dots/glyphs so the team can tune the look (KI-R2).
export function RendererDemo() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [pitch, setPitch] = useState<Pitch>('auto');
  const [mode, setMode] = useState<Mode>('dots');

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const palette = readPalette(document.documentElement);
    const ink = { ink: palette.magic, background: palette.void };
    let img: HTMLImageElement | null = null;
    let frame = 0;
    let disposed = false;
    let draw: (t: number) => void = () => {};

    const layout = () => {
      if (disposed) return;
      cancelAnimationFrame(frame);
      const dpr = window.devicePixelRatio || 1;
      const { width, height } = sizeCanvas(canvas.clientWidth, canvas.clientHeight, dpr);
      canvas.width = width;
      canvas.height = height;
      ctx.fillStyle = palette.void;
      ctx.fillRect(0, 0, width, height);
      if (!img) return;
      const base = pitch === 'auto' ? pitchFor(canvas.clientWidth) : pitch;
      const scale = width / Math.max(canvas.clientWidth, 1);
      if (mode === 'glyphs') {
        const p = base * GLYPH_PITCH_FACTOR;
        const { cols, rows } = gridSize(width, height, p * scale);
        const levels = ditherLevels(containedLuminance(img, cols, rows), cols, rows, GLYPH_RAMP.length);
        drawLevelsAsGlyphs(ctx, levels, cols, rows, { pitch: p, scale, palette: ink });
        return;
      }
      const { cols, rows } = gridSize(width, height, base * scale);
      const lum = containedLuminance(img, cols, rows);
      const frameLum = new Float32Array(lum.length);
      const renderer = new DotRenderer(ctx, { pitch: base, scale, palette: ink });
      let last = -Infinity;
      draw = (t: number) => {
        if (t - last >= FRAME_MS) {
          last = t;
          const b = reduceMotion.matches ? 1 : breath(t);
          for (let i = 0; i < lum.length; i++) frameLum[i] = lum[i]! * b;
          renderer.renderLuminance(frameLum, cols, rows);
        }
        if (!reduceMotion.matches) frame = requestAnimationFrame(draw);
      };
      draw(0);
    };

    // Resizes, and DPR-only changes (dragging to another monitor) that fire no resize (KI-R11).
    const resize = new ResizeObserver(layout);
    resize.observe(canvas);
    let dprQuery: MediaQueryList | null = null;
    const watchDpr = () => {
      dprQuery?.removeEventListener('change', onDpr);
      dprQuery = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      dprQuery.addEventListener('change', onDpr);
    };
    const onDpr = () => {
      watchDpr();
      layout();
    };
    watchDpr();
    reduceMotion.addEventListener('change', layout);

    const sample = new Image();
    sample.src = SAMPLE_SRC;
    sample
      .decode()
      .then(() => {
        img = sample;
        layout();
      })
      .catch(() => {
        /* the stage stays plain void if the art can't load */
      });

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      dprQuery?.removeEventListener('change', onDpr);
      reduceMotion.removeEventListener('change', layout);
    };
  }, [pitch, mode]);

  return (
    <div className="stage-wrap">
      <canvas
        ref={ref}
        className="stage"
        aria-label="Reanimator: a headstone under a crescent moon, drawn in glowing purple dot-matrix on black"
      />
      <nav className="panel" aria-label="Renderer controls">
        <span>pitch</span>
        {(['auto', ...PITCHES] as const).map((p) => (
          <button key={p} type="button" aria-pressed={pitch === p} onClick={() => setPitch(p)}>
            {String(p)}
          </button>
        ))}
        <span>mode</span>
        {(['dots', 'glyphs'] as const).map((m) => (
          <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}>
            {m}
          </button>
        ))}
      </nav>
    </div>
  );
}

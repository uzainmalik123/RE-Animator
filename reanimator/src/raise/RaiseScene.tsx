import { useEffect, useRef, type RefObject } from 'react';
import { VITALS, beats, flatlined, type RitualState, type VitalResult } from '../../shared/ritual';
import { sizeCanvas } from '../canvas';
import { DotRenderer, gridSize } from '../render';
import { pitchFor, readPalette } from '../render/viewport';
import { circleLuminance, monitorLuminance } from './scene';
import { useRitual } from './useRitual';

const FRAME_MS = 1000 / 30;
type Ink = 'magic' | 'death';
type Lum = (cols: number, rows: number, tMs: number) => Float32Array;

// One canvas, one ink (THEME §4: never magic and death on the same element), drawn through the R1
// renderer. Animates at 30fps unless the viewer prefers reduced motion; then it draws one still frame.
function useDotCanvas(ref: RefObject<HTMLCanvasElement | null>, ink: Ink, lum: Lum, deps: unknown[]) {
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
        renderer.renderLuminance(lum(cols, rows, reduceMotion.matches ? 0 : t), cols, rows);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- redraw only when the ritual's state changes
  }, deps);
}

const firstLine = (s: string) => s.split('\n').find((l) => l.trim() !== '')?.trim() ?? '';

function monitorLabel(s: RitualState): string {
  const n = beats(s);
  if (s.status === 'failed') return `Heart monitor: stalled at ${n} of ${VITALS.length} vitals`;
  if (n > 0) return `Heart monitor: ${n} of ${VITALS.length} vitals beating`;
  return flatlined(s) ? `Heart monitor: flatline, the corpse failed ${s.corpse.find((v) => !v.ok)!.vital}` : 'Heart monitor: flatline';
}

function circlePower(s: RitualState): number {
  if (s.status === 'idle') return 0.1;
  return Math.max(0.25, beats(s) / VITALS.length);
}

function VitalLine({ name, result }: { name: string; result: VitalResult | undefined }) {
  const mark = result === undefined ? '·' : result.ok ? '✓' : '✗';
  const cls = result === undefined ? 'pending' : result.ok ? 'beat' : 'flat';
  return (
    <li className={cls}>
      <span className="mark">{mark}</span> {name}
      {result && <span className="ms"> {result.ms} ms</span>}
      {result && firstLine(result.detail) && <div className="detail">{firstLine(result.detail)}</div>}
    </li>
  );
}

// R2: the ritual. A spell circle (magic) that burns brighter with each real vital, and a heart
// monitor that is a red flatline until the revived repo's first vital truly passes. All the facts
// are real text in the panel.
export function RaiseScene({ initial }: { initial?: RitualState } = {}) {
  const live = useRitual();
  const state = initial ?? live.state;
  const circleRef = useRef<HTMLCanvasElement>(null);
  const monitorRef = useRef<HTMLCanvasElement>(null);
  const n = beats(state);
  const power = circlePower(state);
  const beating = n > 0;
  const running = state.status === 'examining' || state.status === 'raising';

  useDotCanvas(circleRef, 'magic', (c, r, t) => circleLuminance(c, r, { tMs: t, power }), [power]);
  useDotCanvas(monitorRef, beating ? 'magic' : 'death', (c, r, t) => monitorLuminance(c, r, { tMs: t, beating }), [beating]);

  return (
    <div className="raise">
      <div className="raise-stage">
        <canvas ref={circleRef} className="raise-circle" aria-label={`Spell circle, ${state.status === 'idle' ? 'unlit' : `burning at ${Math.round(power * 100)}%`}`} />
        <canvas ref={monitorRef} className="raise-monitor" aria-label={monitorLabel(state)} />
      </div>
      <section className="raise-panel" aria-live="polite">
        <h1>{state.repo ?? 'A dead repo waits'}</h1>
        {state.diedIn !== null && <p className="died">died {state.diedIn}</p>}
        <button type="button" disabled={running} onClick={() => void live.start()}>
          Begin the ritual
        </button>
        {live.error && <p className="flat">{live.error}</p>}
        {state.corpse.length > 0 && (
          <>
            <h2>The corpse</h2>
            <ol>
              {state.corpse.map((r) => (
                <VitalLine key={r.vital} name={r.vital} result={r} />
              ))}
            </ol>
          </>
        )}
        {(state.status === 'raising' || state.revived.length > 0) && (
          <>
            <h2>The raise</h2>
            <ol>
              {VITALS.map((v) => (
                <VitalLine key={v} name={v} result={state.revived.find((r) => r.vital === v)} />
              ))}
            </ol>
          </>
        )}
        {state.status === 'failed' && state.failure && <p className="flat">The ritual stalled: {state.failure}</p>}
        {state.status === 'risen' && state.origin && (
          <>
            <p className="beat">
              It lives: <a href={state.origin}>{state.origin}</a>
            </p>
            <iframe className="raise-app" title="The revived app" src={state.origin} />
          </>
        )}
      </section>
    </div>
  );
}

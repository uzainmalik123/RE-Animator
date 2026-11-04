import type { Ctx } from './draw';

export type Call = [string, ...unknown[]];

// A recording stand-in for CanvasRenderingContext2D, for node tests. Each method call (and each
// fillStyle/font assignment) is logged in order, so tests can count dots and compare runs.
export function fakeCtx(width = 0, height = 0): Ctx & { calls: Call[] } {
  const calls: Call[] = [];
  const log = (name: string) => (...args: unknown[]) => void calls.push([name, ...args]);
  let fillStyle: string | CanvasGradient | CanvasPattern = '#000';
  let font = '10px sans-serif';
  return {
    calls,
    canvas: { width, height } as HTMLCanvasElement,
    get fillStyle() { return fillStyle; },
    set fillStyle(v) { fillStyle = v; calls.push(['fillStyle', v]); },
    get font() { return font; },
    set font(v) { font = v; calls.push(['font', v]); },
    textAlign: 'start',
    textBaseline: 'alphabetic',
    fillRect: log('fillRect'),
    clearRect: log('clearRect'),
    beginPath: log('beginPath'),
    arc: log('arc'),
    fill: log('fill'),
    fillText: log('fillText'),
  };
}

export const count = (calls: Call[], name: string) => calls.filter((c) => c[0] === name).length;

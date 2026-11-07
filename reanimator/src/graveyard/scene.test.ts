import { describe, expect, it } from 'vitest';
import { WALK_MS, kiroLuminance, slotX, stonesLuminance, walkProgress } from './scene';

const COLS = 120;
const ROWS = 60;

// The column-weighted centre of mass of a grid's lit cells.
function centreX(g: Float32Array, cols: number): number {
  let sum = 0;
  let weight = 0;
  g.forEach((v, i) => {
    sum += v * (i % cols);
    weight += v;
  });
  return weight === 0 ? NaN : sum / weight;
}

const litIn = (g: Float32Array, cols: number, x0: number, x1: number) => g.reduce((s, v, i) => (i % cols >= x0 && i % cols <= x1 ? s + v : s), 0);

describe('slotX', () => {
  it('spreads stones evenly inside the margins', () => {
    const xs = [0, 1, 2, 3].map((i) => slotX(i, 4));
    expect(xs.every((x) => x > 0 && x < 1)).toBe(true);
    expect(xs.every((x, i) => i === 0 || x > xs[i - 1]!)).toBe(true);
    expect(xs[0]! + xs[3]!).toBeCloseTo(1);
  });

  it('puts a lone stone in the middle, and survives an empty graveyard', () => {
    expect(slotX(0, 1)).toBe(0.5);
    expect(slotX(0, 0)).toBe(0.5);
    expect(Number.isFinite(slotX(3, 2))).toBe(true);
  });
});

describe('walkProgress', () => {
  it('runs from 0 to 1 over the walk, never leaving that range', () => {
    expect(walkProgress(0)).toBe(0);
    expect(walkProgress(WALK_MS)).toBe(1);
    expect(walkProgress(-500)).toBe(0);
    expect(walkProgress(WALK_MS * 5)).toBe(1);
  });

  it('only ever moves forward', () => {
    let last = -1;
    for (let t = 0; t <= WALK_MS; t += 50) {
      const p = walkProgress(t);
      expect(p).toBeGreaterThanOrEqual(last);
      last = p;
    }
  });
});

describe('stonesLuminance', () => {
  const o = { tMs: 500, n: 3, chosen: null };

  it('fills a grid of the right size with values in 0..1', () => {
    const g = stonesLuminance(COLS, ROWS, o);
    expect(g.length).toBe(COLS * ROWS);
    expect(g.every((v) => v >= 0 && v <= 1 && Number.isFinite(v))).toBe(true);
    expect(g.some((v) => v > 0.5)).toBe(true);
  });

  it('is deterministic', () => {
    expect(stonesLuminance(COLS, ROWS, o)).toEqual(stonesLuminance(COLS, ROWS, o));
  });

  it('draws nothing in a grid with no size', () => {
    expect(stonesLuminance(0, 0, o).length).toBe(0);
    expect(stonesLuminance(0, 10, o).length).toBe(0);
  });

  it('still draws the ground when no one is buried, and copes with one stone and with many', () => {
    for (const n of [0, 1, 12]) {
      const g = stonesLuminance(COLS, ROWS, { tMs: 0, n, chosen: null });
      expect(g.every((v) => v >= 0 && v <= 1 && Number.isFinite(v))).toBe(true);
      expect(g[Math.floor(ROWS * 0.82) * COLS + 5]).toBeGreaterThan(0.5);
    }
  });

  it('burns the chosen stone brighter than it would unchosen, and only that one', () => {
    const base = stonesLuminance(COLS, ROWS, { ...o, chosen: null });
    const lit = stonesLuminance(COLS, ROWS, { ...o, chosen: 1 });
    const mid = Math.round(slotX(1, 3) * (COLS - 1));
    expect(litIn(lit, COLS, mid - 8, mid + 8)).toBeGreaterThan(litIn(base, COLS, mid - 8, mid + 8));
    const first = Math.round(slotX(0, 3) * (COLS - 1));
    expect(litIn(lit, COLS, first - 8, first + 8)).toBeCloseTo(litIn(base, COLS, first - 8, first + 8));
  });

  it('ignores a chosen index that is not a stone', () => {
    expect(stonesLuminance(COLS, ROWS, { ...o, chosen: 9 })).toEqual(stonesLuminance(COLS, ROWS, { ...o, chosen: null }));
  });

  it('moves the fog with time, but never the stones', () => {
    const a = stonesLuminance(COLS, ROWS, { ...o, tMs: 0 });
    const b = stonesLuminance(COLS, ROWS, { ...o, tMs: 4000 });
    expect(a).not.toEqual(b);
    // The brightest cells (the outlines) are the same wherever the fog is.
    const bright = (g: Float32Array) => Array.from(g, (v) => v >= 0.75);
    expect(bright(a)).toEqual(bright(b));
  });
});

describe('kiroLuminance', () => {
  const idle = { tMs: 700, n: 3, target: null, walkMs: 0 };

  it('waits in the left third while no stone is chosen, whatever the walk clock says', () => {
    const g = kiroLuminance(COLS, ROWS, idle);
    expect(centreX(g, COLS)).toBeLessThan(COLS / 3);
    expect(kiroLuminance(COLS, ROWS, { ...idle, walkMs: 99_999 })).toEqual(g);
  });

  it('starts the walk at home and ends it beside the chosen stone', () => {
    const start = centreX(kiroLuminance(COLS, ROWS, { ...idle, target: 2, walkMs: 0 }), COLS);
    const end = centreX(kiroLuminance(COLS, ROWS, { ...idle, target: 2, walkMs: WALK_MS }), COLS);
    const stone = slotX(2, 3) * (COLS - 1);
    expect(start).toBeLessThan(COLS / 3);
    expect(Math.abs(end - stone)).toBeLessThan(COLS * 0.1);
    expect(end).toBeLessThan(stone);
  });

  it('stays where it arrived', () => {
    const at = (walkMs: number) => centreX(kiroLuminance(COLS, ROWS, { ...idle, target: 1, walkMs }), COLS);
    expect(at(WALK_MS)).toBeCloseTo(at(WALK_MS * 10), 0);
  });

  it('is finite and in range for an empty graveyard, a lone stone and no grid', () => {
    for (const n of [0, 1]) {
      const g = kiroLuminance(COLS, ROWS, { tMs: 0, n, target: n === 0 ? null : 0, walkMs: 300 });
      expect(g.every((v) => v >= 0 && v <= 1 && Number.isFinite(v))).toBe(true);
    }
    expect(kiroLuminance(0, 0, idle).length).toBe(0);
  });
});

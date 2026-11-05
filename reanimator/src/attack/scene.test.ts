import { describe, expect, it } from 'vitest';
import { QUIET, type AttackState, type Ghost, type Wound } from '../../shared/attack';
import {
  MINION_SPRITES,
  arrival,
  bodyRect,
  deathLayer,
  deathRect,
  idleSpot,
  placeOnBody,
  sceneLabel,
  spriteLuminance,
  vignetteLuminance,
  watchedGhost,
  woundPoints,
  woundSpot,
} from './scene';

const ghost = (id: string, o: Partial<Ghost> = {}): Ghost => ({ ghostId: id, criterion: '1.2', persona: 'wraith', rep: 1, trail: [], done: false, ...o });
const WOUND: Wound = { criterion: '1.2', text: 't', persona: 'wraith', reason: 'r', steps: [], expected: [], failing: [], artifacts: [] };
const state = (o: Partial<AttackState>): AttackState => ({ ...QUIET, ...o });

describe('sprites', () => {
  it('lights every non-space character', () => {
    expect(spriteLuminance(['a b'])).toEqual({ cols: 3, rows: 1, lum: new Float32Array([1, 0, 1]) });
  });

  it('has a four-line sprite for each of the six minions', () => {
    expect(Object.keys(MINION_SPRITES).sort()).toEqual(['banshee', 'changeling', 'doppelganger', 'lich', 'revenant', 'wraith']);
    for (const lines of Object.values(MINION_SPRITES)) expect(lines).toHaveLength(4);
  });
});

describe('layout', () => {
  const body = { x: 10, y: 5, w: 64, h: 36 };

  it('maps a ghost\'s viewport px onto the body', () => {
    expect(placeOnBody(body, 'wraith', 640, 360)).toEqual({ col: 42, row: 23 });
    expect(placeOnBody(body, 'lich', 180, 320)).toEqual({ col: 42, row: 23 });
    expect(placeOnBody(body, 'wraith', 5000, -10)).toEqual({ col: 73, row: 5 });
  });

  it('parks unplaced ghosts along the bottom, inside the grid', () => {
    const a = idleSpot(0, 100, 50);
    const b = idleSpot(1, 100, 50);
    expect(a.row).toBe(b.row);
    expect(a.col).toBeLessThan(b.col);
    expect(a.row).toBeLessThan(50);
  });

  it('fits the frame and Death inside the grid', () => {
    expect(bodyRect(640, 360, 100, 100)).toEqual({ x: 0, y: 22, w: 100, h: 56 });
    expect(bodyRect(0, 0, 100, 100)).toEqual({ x: 0, y: 0, w: 0, h: 0 });
    const d = deathRect(120, 60);
    expect(d.x).toBeGreaterThanOrEqual(0);
    expect(d.x + d.w).toBeLessThanOrEqual(120);
    expect(d.y + d.h).toBeLessThanOrEqual(60);
    expect(d.w).toBeGreaterThan(0);
  });
});

describe('watchedGhost', () => {
  it('watches the earliest running ghost that has a frame', () => {
    const s = state({ status: 'attacking', ghosts: { g1: ghost('g1'), g2: ghost('g2', { frame: 0 }), g3: ghost('g3', { frame: 4 }) } });
    expect(watchedGhost(s)).toBe('g2');
  });

  it('holds on the first wound\'s ghost once the attack is over', () => {
    const s = state({
      status: 'finished',
      wounds: [{ ...WOUND, persona: 'banshee' }],
      ghosts: { g1: ghost('g1', { done: true, frame: 1 }), g2: ghost('g2', { persona: 'banshee', done: true, frame: 3 }) },
    });
    expect(watchedGhost(s)).toBe('g2');
    expect(watchedGhost(state({ status: 'finished', ghosts: { g1: ghost('g1', { done: true, frame: 1 }) } }))).toBe('g1');
    expect(watchedGhost(QUIET)).toBeNull();
  });
});

describe('woundSpot', () => {
  it('lands where the matching minion last acted, the latest rep winning', () => {
    const s = state({ ghosts: { a: ghost('a', { x: 1, y: 1 }), b: ghost('b', { rep: 2, x: 9, y: 9 }), c: ghost('c', { persona: 'lich', rep: 3, x: 5, y: 5 }) } });
    expect(woundSpot(WOUND, s)).toEqual({ x: 9, y: 9, persona: 'wraith' });
    expect(woundSpot({ ...WOUND, criterion: '9.9' }, s)).toBeNull();
  });
});

describe('luminance', () => {
  it('bleeds red in from the edges, never the centre', () => {
    const v = vignetteLuminance(20, 10, 1);
    expect(v[5 * 20 + 10]).toBe(0);
    expect(v[0]).toBeGreaterThan(0.9);
    expect(vignetteLuminance(20, 10, 0).every((x) => x === 0)).toBe(true);
    expect(vignetteLuminance(0, 10, 1)).toHaveLength(0);
  });

  it('draws minions and wounds deterministically', () => {
    const o = { strength: 0, minions: [{ col: 20, row: 10, persona: 'wraith', trail: [{ col: 15, row: 10 }] }], wounds: [{ col: 5, row: 5 }], death: null, deathRect: null };
    const a = deathLayer(40, 20, o);
    expect(a).toEqual(deathLayer(40, 20, o));
    expect(a[5 * 40 + 5]).toBe(1);
    expect(Math.max(...a.slice(9 * 40 + 12, 9 * 40 + 18))).toBeCloseTo(0.5);
    expect(deathLayer(0, 20, o)).toHaveLength(0);
  });

  it('places Death\'s own image into his rect', () => {
    const death = new Float32Array([1, 1, 1, 1]);
    const a = deathLayer(10, 10, { strength: 0, minions: [], wounds: [], death, deathRect: { x: 3, y: 4, w: 2, h: 2 } });
    expect(a[4 * 10 + 3]).toBe(1);
    expect(a[5 * 10 + 4]).toBe(1);
    expect(a[0]).toBe(0);
  });
});

describe('motion and words', () => {
  it('ramps Death in over 1.5 s, or at once for reduced motion', () => {
    expect(arrival(750, 0, false)).toBe(0.5);
    expect(arrival(5000, 0, false)).toBe(1);
    expect(arrival(0, 0, true)).toBe(1);
  });

  it('says what the scene shows', () => {
    expect(sceneLabel(QUIET)).toBe('Death waits');
    expect(sceneLabel(state({ status: 'attacking', ghosts: { a: ghost('a'), b: ghost('b', { done: true }) } }))).toBe('Death attacks: 1 minion, 0 wounds');
    expect(sceneLabel(state({ status: 'finished', wounds: [WOUND, WOUND], ghosts: { a: ghost('a') } }))).toBe('Death attacked: 0 minions, 2 wounds');
    expect(sceneLabel(state({ status: 'failed' }))).toBe('Death faltered');
  });
});

describe('woundPoints', () => {
  it('puts each wound where its minion acted, as a fraction of the body, else in a fixed slot', () => {
    const s = state({ status: 'finished', wounds: [WOUND, { ...WOUND, criterion: '2.1' }], ghosts: { a: ghost('a', { x: 640, y: 180 }) } });
    expect(woundPoints(s)).toEqual([
      { key: '1.2-wraith', label: '1.2 · wraith', fx: 0.5, fy: 0.25 },
      { key: '2.1-wraith', label: '2.1 · wraith', fx: 0.85, fy: 0.27 },
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import { MAX_MARKS, slabLuminance } from './scene';

const sum = (a: Float32Array) => a.reduce((s, v) => s + v, 0);

describe('slabLuminance (R8)', () => {
  it('has one value per cell, all within 0..1', () => {
    const g = slabLuminance(40, 12, { tMs: 1234, causes: 3 });
    expect(g).toHaveLength(480);
    expect(Math.min(...g)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...g)).toBeLessThanOrEqual(1);
    expect(sum(g)).toBeGreaterThan(0);
  });

  it('survives an empty grid', () => {
    expect(slabLuminance(0, 0, { tMs: 0, causes: 2 })).toHaveLength(0);
    expect(slabLuminance(10, 0, { tMs: 0, causes: 2 })).toHaveLength(0);
    expect(slabLuminance(1, 1, { tMs: 0, causes: 2 })).toHaveLength(1);
  });

  it('is deterministic for the same time, and the scan light moves with time', () => {
    const a = slabLuminance(40, 12, { tMs: 500, causes: 2 });
    expect(slabLuminance(40, 12, { tMs: 500, causes: 2 })).toEqual(a);
    expect(slabLuminance(40, 12, { tMs: 2500, causes: 2 })).not.toEqual(a);
  });

  it('lights one more mark per cause, up to a cap', () => {
    const at = (causes: number) => sum(slabLuminance(60, 14, { tMs: 0, causes }));
    expect(at(1)).toBeGreaterThan(at(0));
    expect(at(5)).toBeGreaterThan(at(1));
    expect(at(MAX_MARKS + 20)).toBe(at(MAX_MARKS));
  });
});

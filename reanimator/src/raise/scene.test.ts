import { describe, expect, it } from 'vitest';
import { circleLuminance, monitorLuminance } from './scene';

const sum = (a: Float32Array) => a.reduce((s, v) => s + v, 0);
const C = 80;
const R = 60;

describe('circleLuminance', () => {
  it('is deterministic', () => {
    expect(circleLuminance(C, R, { tMs: 1234, power: 0.5 })).toEqual(circleLuminance(C, R, { tMs: 1234, power: 0.5 }));
  });

  it('glows brighter with more power', () => {
    expect(sum(circleLuminance(C, R, { tMs: 0, power: 1 }))).toBeGreaterThan(sum(circleLuminance(C, R, { tMs: 0, power: 0.25 })));
  });

  it('is a ring, dark at the centre', () => {
    const lum = circleLuminance(C, R, { tMs: 0, power: 1 });
    expect(lum[(R / 2) * C + C / 2]).toBe(0);
    expect(sum(lum)).toBeGreaterThan(0);
  });

  it('rotates with time', () => {
    expect(circleLuminance(C, R, { tMs: 0, power: 1 })).not.toEqual(circleLuminance(C, R, { tMs: 700, power: 1 }));
  });

  it('stays within 0..1', () => {
    const lum = circleLuminance(C, R, { tMs: 0, power: 1 });
    expect(Math.max(...lum)).toBeLessThanOrEqual(1);
    expect(Math.min(...lum)).toBeGreaterThanOrEqual(0);
  });

  it('handles an empty grid', () => {
    expect(circleLuminance(0, 0, { tMs: 0, power: 1 })).toHaveLength(0);
  });
});

describe('monitorLuminance', () => {
  const lit = (lum: Float32Array) => [...lum.keys()].filter((i) => lum[i]! > 0).map((i) => Math.floor(i / C));

  it('flatline lights only the middle row', () => {
    expect(new Set(lit(monitorLuminance(C, 20, { tMs: 0, beating: false })))).toEqual(new Set([10]));
  });

  it('a beating trace rises above the baseline', () => {
    expect(lit(monitorLuminance(C, 20, { tMs: 300, beating: true })).some((row) => row < 10)).toBe(true);
  });

  it('only the beating trace scrolls with time', () => {
    expect(monitorLuminance(C, 20, { tMs: 0, beating: false })).toEqual(monitorLuminance(C, 20, { tMs: 500, beating: false }));
    expect(monitorLuminance(C, 20, { tMs: 0, beating: true })).not.toEqual(monitorLuminance(C, 20, { tMs: 250, beating: true }));
  });
});

import { describe, expect, it } from 'vitest';
import { sizeCanvas } from './canvas';

describe('sizeCanvas', () => {
  it('scales by devicePixelRatio', () => {
    expect(sizeCanvas(800, 600, 2)).toEqual({ width: 1600, height: 1200 });
  });

  it('rounds fractional sizes', () => {
    expect(sizeCanvas(333, 100, 1.5)).toEqual({ width: 500, height: 150 });
  });

  it('treats a missing or bad devicePixelRatio as 1', () => {
    expect(sizeCanvas(10, 10, 0)).toEqual({ width: 10, height: 10 });
    expect(sizeCanvas(10, 10, NaN)).toEqual({ width: 10, height: 10 });
  });
});

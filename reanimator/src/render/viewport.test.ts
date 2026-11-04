import { describe, expect, it } from 'vitest';
import { breath, containRect, pitchFor } from './viewport';

describe('containRect', () => {
  it('fits a square image centred in a wide box', () => {
    expect(containRect(100, 100, 400, 200)).toEqual({ x: 100, y: 0, w: 200, h: 200 });
  });

  it('is empty for a zero-size box or image', () => {
    expect(containRect(100, 100, 0, 0)).toEqual({ x: 0, y: 0, w: 0, h: 0 });
    expect(containRect(0, 0, 10, 10)).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });
});

describe('pitchFor', () => {
  it('uses 2px dots on phones and 3px on wider screens', () => {
    expect(pitchFor(375)).toBe(2);
    expect(pitchFor(639)).toBe(2);
    expect(pitchFor(640)).toBe(3);
    expect(pitchFor(1920)).toBe(3);
  });
});

describe('breath', () => {
  it('starts at full brightness and dips to 0.85 halfway through a 4s breath', () => {
    expect(breath(0)).toBe(1);
    expect(breath(2000)).toBeCloseTo(0.85);
    expect(breath(4000)).toBeCloseTo(1);
  });

  it('stays between 0.85 and 1', () => {
    for (let t = 0; t < 10000; t += 97) {
      expect(breath(t)).toBeGreaterThanOrEqual(0.85 - 1e-9);
      expect(breath(t)).toBeLessThanOrEqual(1 + 1e-9);
    }
  });
});

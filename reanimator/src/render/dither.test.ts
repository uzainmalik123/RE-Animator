import { describe, expect, it } from 'vitest';
import { GLYPH_RAMP, ditherLevels, gridSize, levelsToText, luminanceGrid } from './dither';

function rgba(pixels: [number, number, number, number][]): Uint8ClampedArray {
  return new Uint8ClampedArray(pixels.flat());
}

describe('gridSize', () => {
  it('floors the canvas into pitch-sized cells', () => {
    expect(gridSize(800, 600, 3)).toEqual({ cols: 266, rows: 200 });
  });

  it('is empty for a zero-size canvas or a zero pitch', () => {
    expect(gridSize(0, 0, 3)).toEqual({ cols: 0, rows: 0 });
    expect(gridSize(10, 10, 0)).toEqual({ cols: 0, rows: 0 });
    expect(gridSize(Number.NaN, 10, 2)).toEqual({ cols: 0, rows: 0 });
  });
});

describe('luminanceGrid', () => {
  it('reads opaque white as 1 and black as 0', () => {
    const lum = luminanceGrid(rgba([[255, 255, 255, 255], [0, 0, 0, 255]]), 2, 1);
    expect(lum[0]).toBeCloseTo(1);
    expect(lum[1]).toBe(0);
  });

  it('treats transparent pixels as dark', () => {
    expect(luminanceGrid(rgba([[255, 255, 255, 0]]), 1, 1)[0]).toBe(0);
  });

  it('uses Rec. 709 weights, with gamma 1 leaving mid-grey alone', () => {
    expect(luminanceGrid(rgba([[128, 128, 128, 255]]), 1, 1, 1)[0]).toBeCloseTo(0.502, 3);
    expect(luminanceGrid(rgba([[0, 255, 0, 255]]), 1, 1, 1)[0]).toBeCloseTo(0.7152, 4);
  });
});

describe('ditherLevels', () => {
  it('leaves darkness empty and fills full brightness to the top step', () => {
    expect([...ditherLevels(new Float32Array(16), 4, 4, 4)]).toEqual(new Array(16).fill(0));
    expect([...ditherLevels(new Float32Array(16).fill(1), 4, 4, 4)]).toEqual(new Array(16).fill(3));
  });

  it('clamps out-of-range values and treats NaN as dark', () => {
    expect([...ditherLevels(Float32Array.from([2, -1, Number.NaN]), 3, 1, 4)]).toEqual([3, 0, 0]);
  });

  it('lights exactly half the cells of a mid-grey 4x4 block, the same way every time', () => {
    const lum = new Float32Array(16).fill(0.5);
    const a = ditherLevels(lum, 4, 4, 2);
    expect(a.reduce((n, l) => n + l, 0)).toBe(8);
    expect([...ditherLevels(lum, 4, 4, 2)]).toEqual([...a]);
  });

  it('pins a dark-to-light gradient as glyphs', () => {
    const cols = 16;
    const rows = 8;
    const lum = new Float32Array(cols * rows).map((_, i) => (i % cols) / 15);
    expect('\n' + levelsToText(ditherLevels(lum, cols, rows, GLYPH_RAMP.length), cols, GLYPH_RAMP)).toMatchInlineSnapshot(`
      "
       ..::--==+*##%%@
        ::--==++*##%@@
       ..::--=+**##%%@
       .::--==++**%%@@
       ..::--==+*##%%@
        ::--==++*##%@@
       ..::--=+**##%%@
       .::--==++**%%@@"
    `);
  });
});

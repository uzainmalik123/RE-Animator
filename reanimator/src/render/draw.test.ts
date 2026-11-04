import { describe, expect, it } from 'vitest';
import { ditherLevels, gridSize, GLYPH_RAMP } from './dither';
import { drawLevelsAsDots, drawLevelsAsGlyphs } from './draw';
import { count, fakeCtx } from './fake-ctx';

const palette = { ink: '#b98cff', background: '#06060a' };

describe('drawLevelsAsDots', () => {
  it('draws one dot per lit cell, centred, sized by its level', () => {
    const ctx = fakeCtx();
    const drawn = drawLevelsAsDots(ctx, Uint8Array.from([0, 3, 1, 0]), 2, 2, { pitch: 3, gap: 1, palette });
    expect(drawn).toBe(2);
    expect(count(ctx.calls, 'arc')).toBe(2);
    const firstArc = ctx.calls.find((c) => c[0] === 'arc')!;
    expect(firstArc.slice(1, 4)).toEqual([4.5, 1.5, 1]);
  });

  it('draws squares instead of circles when asked', () => {
    const ctx = fakeCtx();
    drawLevelsAsDots(ctx, Uint8Array.from([0, 3, 1, 0]), 2, 2, { pitch: 3, palette, shape: 'square' });
    expect(count(ctx.calls, 'arc')).toBe(0);
    expect(count(ctx.calls, 'fillRect')).toBe(3); // background + 2 dots
  });

  it('draws more dots at a finer pitch', () => {
    const dots = (pitch: number) => {
      const { cols, rows } = gridSize(60, 60, pitch);
      const levels = ditherLevels(new Float32Array(cols * rows).fill(0.6), cols, rows, 4);
      return drawLevelsAsDots(fakeCtx(), levels, cols, rows, { pitch, palette });
    };
    expect(dots(2)).toBeGreaterThan(dots(6));
  });

  it('makes the same calls for the same input', () => {
    const run = () => {
      const ctx = fakeCtx();
      const lum = new Float32Array(64).map((_, i) => i / 63);
      drawLevelsAsDots(ctx, ditherLevels(lum, 8, 8, 4), 8, 8, { pitch: 3, palette, scale: 2 });
      return ctx.calls;
    };
    expect(run()).toEqual(run());
  });
});

describe('drawLevelsAsGlyphs', () => {
  it('writes ramp characters for lit cells and never a space', () => {
    const ctx = fakeCtx();
    const levels = ditherLevels(new Float32Array(16).map((_, i) => i / 15), 4, 4, GLYPH_RAMP.length);
    const drawn = drawLevelsAsGlyphs(ctx, levels, 4, 4, { pitch: 10, palette });
    const chars = ctx.calls.filter((c) => c[0] === 'fillText').map((c) => c[1] as string);
    expect(chars.length).toBe(drawn);
    expect(drawn).toBeGreaterThan(0);
    for (const ch of chars) {
      expect(GLYPH_RAMP).toContain(ch);
      expect(ch).not.toBe(' ');
    }
  });
});

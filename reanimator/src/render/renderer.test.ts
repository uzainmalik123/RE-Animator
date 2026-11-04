import { describe, expect, it } from 'vitest';
import { DotRenderer } from './renderer';
import { count, fakeCtx } from './fake-ctx';

const palette = { ink: '#b98cff', background: '#06060a' };
const ones = (n: number) => new Float32Array(n).fill(1);

describe('DotRenderer', () => {
  it('paints every lit cell on the first frame', () => {
    const r = new DotRenderer(fakeCtx(), { pitch: 3, palette });
    expect(r.renderLuminance(ones(16), 4, 4)).toBe(16);
  });

  it('repaints nothing when the frame has not changed', () => {
    const ctx = fakeCtx();
    const r = new DotRenderer(ctx, { pitch: 3, palette });
    r.renderLuminance(ones(16), 4, 4);
    const arcs = count(ctx.calls, 'arc');
    expect(r.renderLuminance(ones(16), 4, 4)).toBe(0);
    expect(count(ctx.calls, 'arc')).toBe(arcs);
  });

  it('clears just the one cell that went dark', () => {
    const ctx = fakeCtx();
    const r = new DotRenderer(ctx, { pitch: 3, palette });
    r.renderLuminance(ones(16), 4, 4);
    const before = ctx.calls.length;
    const frame = ones(16);
    frame[5] = 0;
    expect(r.renderLuminance(frame, 4, 4)).toBe(1);
    const after = ctx.calls.slice(before);
    expect(after.filter((c) => c[0] === 'arc')).toHaveLength(0);
    expect(after.filter((c) => c[0] === 'fillRect')).toEqual([['fillRect', 3, 3, 3, 3]]);
  });

  it('repaints everything when the grid size changes', () => {
    const r = new DotRenderer(fakeCtx(), { pitch: 3, palette });
    r.renderLuminance(ones(16), 4, 4);
    expect(r.renderLuminance(ones(20), 5, 4)).toBe(20);
  });

  it('repaints everything after reset', () => {
    const r = new DotRenderer(fakeCtx(), { pitch: 3, palette });
    r.renderLuminance(ones(16), 4, 4);
    r.reset();
    expect(r.renderLuminance(ones(16), 4, 4)).toBe(16);
  });
});

import { describe, expect, it } from 'vitest';
import { diffLines } from './diff.js';

describe('diffLines', () => {
  it('gives nothing for identical input', () => {
    expect(diffLines(['a', 'b'], ['a', 'b'])).toEqual([]);
    expect(diffLines([], [])).toEqual([]);
  });

  it('shows one changed line with one line of context each side', () => {
    expect(diffLines(['a', 'b', 'c', 'd', 'e'], ['a', 'b', 'X', 'd', 'e'])).toEqual([
      { op: ' ', text: 'b' },
      { op: '-', text: 'c' },
      { op: '+', text: 'X' },
      { op: ' ', text: 'd' },
    ]);
  });

  it('handles a pure addition and a pure deletion', () => {
    expect(diffLines(['a'], ['a', 'b'])).toEqual([
      { op: ' ', text: 'a' },
      { op: '+', text: 'b' },
    ]);
    expect(diffLines(['a', 'b'], ['a'])).toEqual([
      { op: ' ', text: 'a' },
      { op: '-', text: 'b' },
    ]);
    expect(diffLines([], ['x'])).toEqual([{ op: '+', text: 'x' }]);
    expect(diffLines(['x'], [])).toEqual([{ op: '-', text: 'x' }]);
  });

  it('keeps two far-apart changes as two hunks without the middle', () => {
    const a = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
    const b = ['X', '2', '3', '4', '5', '6', '7', '8', 'Y'];
    const d = diffLines(a, b);
    expect(d.map((l) => l.text)).not.toContain('5');
    expect(d.filter((l) => l.op === '-').map((l) => l.text)).toEqual(['1', '9']);
    expect(d.filter((l) => l.op === '+').map((l) => l.text)).toEqual(['X', 'Y']);
  });

  it('is a valid edit script: with unlimited context it rebuilds both sides exactly', () => {
    const a = ['a', 'b', 'c', 'd', 'e', 'f'];
    const b = ['a', 'c', 'b', 'd', 'x', 'f'];
    const d = diffLines(a, b, Infinity);
    expect(d.filter((l) => l.op !== '+').map((l) => l.text)).toEqual(a);
    expect(d.filter((l) => l.op !== '-').map((l) => l.text)).toEqual(b);
  });
});

describe('diffLines on hostile sizes', () => {
  it('does not build a huge table: two big different files fall back to a block', () => {
    const a = Array.from({ length: 30_000 }, (_, i) => `a${i}`);
    const b = Array.from({ length: 30_000 }, (_, i) => `b${i}`);
    const d = diffLines(a, b, Infinity);
    expect(d.filter((l) => l.op === '-')).toHaveLength(30_000);
    expect(d.filter((l) => l.op === '+')).toHaveLength(30_000);
  });

  it('still finds the one real change in big files with common ends', () => {
    const a = Array.from({ length: 30_000 }, (_, i) => `l${i}`);
    const b = [...a];
    b[15_000] = 'changed';
    expect(diffLines(a, b)).toEqual([
      { op: ' ', text: 'l14999' },
      { op: '-', text: 'l15000' },
      { op: '+', text: 'changed' },
      { op: ' ', text: 'l15001' },
    ]);
  });
});


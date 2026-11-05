import { describe, expect, it } from 'vitest';
import { isManifest, parseLines, redactHome } from './recording.js';

describe('recording format (R11)', () => {
  it('parses lines and skips blank ones', () => {
    const a = { t: 0, stream: 'ritual', id: 'r1', event: { type: 'started', repo: 'x', diedIn: '2016' } };
    const b = { t: 5, stream: 'attack', id: 'a1', event: { type: 'failed', reason: 'no' } };
    const lines = parseLines(`${JSON.stringify(a)}\n${JSON.stringify(b)}\n\n`);
    expect(lines).toEqual([a, b]);
  });

  it('refuses a line from an unknown stream', () => {
    expect(() => parseLines('{"t":0,"stream":"x","id":"a","event":{"type":"y"}}')).toThrow('bad recording line 1');
  });

  it('refuses a line that is not JSON', () => {
    expect(() => parseLines('{"t":0}\nnope')).toThrow('bad recording line 1');
  });

  it('knows a manifest of version 1 only', () => {
    expect(isManifest({ format: 'reanimator-recording', version: 1, recordedAt: '2026-11-20T10:00:00Z' })).toBe(true);
    expect(isManifest({ format: 'reanimator-recording', version: 2, recordedAt: '2026-11-20T10:00:00Z' })).toBe(false);
    expect(isManifest(null)).toBe(false);
  });

  it('replaces the home directory with ~', () => {
    expect(redactHome('{"p":"/home/u/x","q":"/home/u"}', '/home/u')).toBe('{"p":"~/x","q":"~"}');
    expect(redactHome('{"p":"/x"}', '/')).toBe('{"p":"/x"}');
    expect(redactHome('{"p":"/x"}', '')).toBe('{"p":"/x"}');
  });
});

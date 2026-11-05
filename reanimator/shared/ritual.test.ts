import { describe, expect, it } from 'vitest';
import { IDLE, beats, flatlined, reduceRitual, type RitualEvent, type RitualState } from './ritual.js';

const fold = (events: RitualEvent[], from: RitualState = IDLE) => events.reduce(reduceRitual, from);
const started: RitualEvent = { type: 'started', repo: 'guestbook-2016', diedIn: 2016 };
const ok = (vital: 'install' | 'build' | 'serve' | 'render'): RitualEvent => ({
  type: 'vital',
  phase: 'revived',
  result: { vital, ok: true, detail: '', ms: 5 },
});

describe('reduceRitual', () => {
  it('starts examining the corpse', () => {
    expect(fold([started])).toEqual({
      ...IDLE,
      status: 'examining',
      repo: 'guestbook-2016',
      diedIn: 2016,
    });
  });

  it('records the corpse failing as a flatline, still examining', () => {
    const s = fold([started, { type: 'vital', phase: 'corpse', result: { vital: 'install', ok: false, detail: 'EBADENGINE', ms: 9 } }]);
    expect(s.corpse).toHaveLength(1);
    expect(flatlined(s)).toBe(true);
    expect(s.status).toBe('examining');
    expect(beats(s)).toBe(0);
  });

  it('moves to raising on the remedy', () => {
    expect(fold([started, { type: 'remedy', files: 2 }]).status).toBe('raising');
  });

  it('counts revived vitals as beats and rises with an origin', () => {
    const s = fold([started, { type: 'remedy', files: 2 }, ok('install'), ok('build')]);
    expect(beats(s)).toBe(2);
    const risen = reduceRitual(s, { type: 'risen', origin: 'http://127.0.0.1:5000' });
    expect(risen.status).toBe('risen');
    expect(risen.origin).toBe('http://127.0.0.1:5000');
  });

  it('fails with a reason and keeps only the passed beats', () => {
    const s = fold([
      started,
      { type: 'remedy', files: 2 },
      ok('install'),
      ok('build'),
      { type: 'vital', phase: 'revived', result: { vital: 'serve', ok: false, detail: 'exited with code 1', ms: 3 } },
      { type: 'failed', phase: 'revived', reason: 'serve: exited with code 1' },
    ]);
    expect(s.status).toBe('failed');
    expect(s.failure).toBe('serve: exited with code 1');
    expect(beats(s)).toBe(2);
  });

  it('starts a fresh ritual after a finished one', () => {
    const done = fold([started, { type: 'remedy', files: 2 }, ok('install'), { type: 'risen', origin: 'http://127.0.0.1:1' }]);
    expect(reduceRitual(done, started)).toEqual(fold([started]));
  });

  it('never mutates its input', () => {
    const s = Object.freeze(fold([started]));
    const frozenCorpse = Object.freeze(s.corpse);
    expect(() =>
      reduceRitual(s, { type: 'vital', phase: 'corpse', result: { vital: 'install', ok: false, detail: '', ms: 1 } }),
    ).not.toThrow();
    expect(frozenCorpse).toHaveLength(0);
  });
  it('keeps the rites the remedy applied', () => {
    expect(fold([started]).rites).toEqual([]);
    expect(fold([started, { type: 'remedy', files: 2, rites: ['engines', 'openssl'] }]).rites).toEqual(['engines', 'openssl']);
    expect(fold([started, { type: 'remedy', files: 2 }]).rites).toEqual([]);
  });
});

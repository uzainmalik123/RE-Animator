import { describe, expect, it } from 'vitest';
import { BLANK, reduceGrimoire, ruledLines, spellOver, type GrimoireState, type SpellEvent } from './grimoire.js';

const fold = (events: SpellEvent[], from: GrimoireState = BLANK) => events.reduce(reduceGrimoire, from);
const HEAL = { criterion: '1.2', persona: 'wraith' };

describe('reduceGrimoire', () => {
  it('starts a spell on the same book, casting', () => {
    const first = fold([{ type: 'cast', text: 'one', heal: null }, { type: 'quill', text: 'done' }, { type: 'sealed', stopReason: 'end_turn' }]);
    const s = fold([{ type: 'cast', text: 'two', heal: HEAL }], first);
    expect(s.status).toBe('casting');
    expect(s.heal).toEqual(HEAL);
    expect(s.stopReason).toBeNull();
    expect(s.failure).toBeNull();
    expect(s.pages).toEqual([
      { kind: 'spell', text: 'one' },
      { kind: 'quill', text: 'done' },
      { kind: 'spell', text: 'two' },
    ]);
  });

  it('merges consecutive quill chunks, and a margin breaks them', () => {
    const s = fold([
      { type: 'cast', text: 'x', heal: null },
      { type: 'quill', text: 'Hel' },
      { type: 'quill', text: 'lo' },
      { type: 'margin', id: 't1', title: 'Reading server.js', status: 'pending' },
      { type: 'quill', text: 'Again' },
    ]);
    expect(s.pages.slice(1)).toEqual([
      { kind: 'quill', text: 'Hello' },
      { kind: 'margin', id: 't1', title: 'Reading server.js', status: 'pending' },
      { kind: 'quill', text: 'Again' },
    ]);
  });

  it('updates a known margin note in place, keeping its title when the update has none', () => {
    const s = fold([
      { type: 'cast', text: 'x', heal: null },
      { type: 'margin', id: 't1', title: 'Reading server.js', status: 'pending' },
      { type: 'quill', text: 'hm' },
      { type: 'margin', id: 't1', title: '', status: 'completed' },
      { type: 'margin', id: 't2', title: 'Edit', status: 'pending' },
    ]);
    expect(s.pages.filter((p) => p.kind === 'margin')).toEqual([
      { kind: 'margin', id: 't1', title: 'Reading server.js', status: 'completed' },
      { kind: 'margin', id: 't2', title: 'Edit', status: 'pending' },
    ]);
  });

  it('draws an edit as a ruled box', () => {
    const s = fold([{ type: 'cast', text: 'x', heal: null }, { type: 'ruled', path: 'server.js', oldText: 'a\nb', newText: 'a\nB' }]);
    expect(s.pages.at(-1)).toEqual({ kind: 'ruled', path: 'server.js', lines: [{ sign: '-', text: 'b' }, { sign: '+', text: 'B' }] });
  });

  it('lights the candle, seals, and fails', () => {
    const lit = fold([{ type: 'cast', text: 'x', heal: null }, { type: 'candle', used: 1200, size: 200000 }]);
    expect(lit.candle).toEqual({ used: 1200, size: 200000 });
    const sealed = fold([{ type: 'sealed', stopReason: 'end_turn' }], lit);
    expect(sealed.status).toBe('sealed');
    expect(sealed.stopReason).toBe('end_turn');
    const failed = fold([{ type: 'failed', reason: 'no' }], lit);
    expect(failed.status).toBe('failed');
    expect(failed.failure).toBe('no');
  });

  it('knows when a spell is over', () => {
    expect(spellOver({ type: 'sealed', stopReason: 'end_turn' })).toBe(true);
    expect(spellOver({ type: 'failed', reason: 'x' })).toBe(true);
    expect(spellOver({ type: 'quill', text: 'x' })).toBe(false);
  });
});

describe('ruledLines', () => {
  it('drops the common head and tail', () => {
    expect(ruledLines('a\nb\nc', 'a\nB\nc')).toEqual([{ sign: '-', text: 'b' }, { sign: '+', text: 'B' }]);
  });

  it('shows a new file as additions only', () => {
    expect(ruledLines('', 'x')).toEqual([{ sign: '+', text: 'x' }]);
  });

  it('shows a pure insertion without minus lines', () => {
    expect(ruledLines('a\nc', 'a\nb\nc')).toEqual([{ sign: '+', text: 'b' }]);
  });
});

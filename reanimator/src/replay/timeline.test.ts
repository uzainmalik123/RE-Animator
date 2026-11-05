import { describe, expect, it } from 'vitest';
import { parseLines, type RecordedLine } from '../../shared/recording';
import session from './fixtures/session.ndjson?raw';
import { EMPTY_SESSION, advance, foldTo, schedule, step } from './timeline';

// A synthetic session, for tests only: it is never published (D-R11, D-R22).
const lines = parseLines(session);
const at = (t: number): RecordedLine => ({ t, stream: 'ritual', id: 'r', event: { type: 'started', repo: 'x', diedIn: 2016 } });

describe('schedule (R11)', () => {
  it('keeps real gaps and shortens long pauses to 2 s', () => {
    expect(schedule([at(0), at(100), at(60_000), at(60_050)])).toEqual([0, 100, 2100, 2150]);
  });

  it('never runs backwards', () => {
    expect(schedule([at(500), at(200), at(300)])).toEqual([0, 0, 100]);
  });
});

describe('the session fold (R11)', () => {
  it('ends where the recorded run ended: risen, the heal clean, the grimoire sealed', () => {
    const s = foldTo(lines, lines.length);
    expect(s.ritual).toMatchObject({ id: 'r1', state: { status: 'risen', origin: 'http://127.0.0.1:5001' } });
    expect(s.attack.id).toBe('a2');
    expect(s.attack.state.status).toBe('finished');
    expect(s.attack.state.wounds).toEqual([]);
    expect(s.spell).toMatchObject({ id: 's1', state: { status: 'sealed' } });
  });

  it('starts a new attack from QUIET, as useAttack does', () => {
    const firstDone = lines.findIndex((l) => l.id === 'a1' && l.event.type === 'finished') + 1;
    expect(foldTo(lines, firstDone).attack.state.wounds).toHaveLength(1);
    const next = step(foldTo(lines, firstDone), { t: 0, stream: 'attack', id: 'a9', event: { type: 'failed', reason: 'x' } });
    expect(next.attack.id).toBe('a9');
    expect(next.attack.state.wounds).toEqual([]);
    expect(next.attack.state.ghosts).toEqual({});
  });

  it('keeps earlier pages when a second spell is cast', () => {
    const s = step(foldTo(lines, lines.length), { t: 0, stream: 'spell', id: 's2', event: { type: 'cast', text: 'again', heal: null } });
    expect(s.spell.id).toBe('s2');
    expect(s.spell.state.pages.filter((p) => p.kind === 'spell')).toHaveLength(2);
  });

  it('clears Death and the grimoire when a new ritual begins', () => {
    const s = step(foldTo(lines, lines.length), { t: 0, stream: 'ritual', id: 'r2', event: { type: 'started', repo: 'x', diedIn: 2016 } });
    expect(s.ritual.id).toBe('r2');
    expect(s.ritual.state.status).toBe('examining');
    expect(s.attack).toEqual(EMPTY_SESSION.attack);
    expect(s.spell).toEqual(EMPTY_SESSION.spell);
  });
});

describe('advance (R11)', () => {
  it('plays every line due at the same moment in one step', () => {
    const ls = [at(0), at(0), at(100)];
    const times = schedule(ls);
    const first = advance({ n: 0, session: EMPTY_SESSION }, ls, times);
    expect(first.n).toBe(2);
    expect(advance(first, ls, times).n).toBe(3);
  });

  it('stays put at the end', () => {
    const ls = [at(0)];
    const end = advance({ n: 0, session: EMPTY_SESSION }, ls, schedule(ls));
    expect(advance(end, ls, schedule(ls))).toBe(end);
  });
});

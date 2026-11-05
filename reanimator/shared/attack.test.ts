import { describe, expect, it } from 'vitest';
import { QUIET, attackOver, reduceAttack, type AttackEvent, type Counts, type EngineEvent, type Wound, woundKey } from './attack.js';

const COUNTS: Counts = { haunted: 1, flaky: 0, inconclusive: 0, clean: 1, notApplicable: 0, notRun: 0 };
const WOUND: Wound = { criterion: '1.2', text: 'record only one entry', persona: 'wraith', reason: 'two entries', steps: [], expected: [], failing: [], artifacts: [], carried: false };
const sum = (origin: string, only: string[] | null = null): AttackEvent => ({ type: 'summoned', origin, only, heal: null, body: '/b', wounds: [], healed: [] });
const fin = (wounds: Wound[]): AttackEvent => ({ type: 'finished', counts: COUNTS, wounds, healed: [], heal: null });

describe('reduceAttack', () => {
  it('folds a whole attack', () => {
    const log: AttackEvent[] = [
      sum('http://127.0.0.1:5555'),
      { type: 'engine', event: { type: 'run.started', criteria: ['1.1', '1.2'], personas: ['wraith', 'banshee', 'lich'], reps: 3 } },
      { type: 'engine', event: { type: 'scout.route', path: '/', status: 'ok' } },
      { type: 'engine', event: { type: 'plan.compiled', criterion: '1.1', persona: 'wraith', status: 'compiled', cached: false } },
      { type: 'engine', event: { type: 'plan.compiled', criterion: '1.2', persona: 'wraith', status: 'compiled', cached: true } },
      { type: 'engine', event: { type: 'verdict.criterion', criterion: '1.2', verdict: 'haunted' } },
      fin([WOUND]),
    ];
    const s = log.reduce(reduceAttack, QUIET);
    expect(s).toMatchObject({ status: 'finished', origin: 'http://127.0.0.1:5555', routes: 1, planned: 6, plans: 2, verdicts: { '1.2': 'haunted' }, counts: COUNTS });
    expect(s.wounds).toEqual([WOUND]);
    expect(attackOver(log.at(-1)!)).toBe(true);
    expect(attackOver(log[0]!)).toBe(false);
  });

  it('records a failure', () => {
    const s = reduceAttack(reduceAttack(QUIET, sum('o')), { type: 'failed', reason: 'boom' });
    expect(s).toMatchObject({ status: 'failed', failure: 'boom' });
  });

  it('starts fresh on a new summon', () => {
    const done = reduceAttack(QUIET, fin([WOUND]));
    const s = reduceAttack(done, sum('o2', ['1.2']));
    expect(s).toEqual({ ...QUIET, status: 'attacking', origin: 'o2', body: '/b' });
  });
});

describe('reduceAttack: ghosts', () => {
  const on = (s: ReturnType<typeof reduceAttack>, ...events: EngineEvent[]) => events.reduce((x, event) => reduceAttack(x, { type: 'engine', event }), s);
  const summoned = reduceAttack(QUIET, sum('o'));
  const spawn: EngineEvent = { type: 'ghost.spawned', ghostId: 'g1', criterion: '1.2', persona: 'wraith', rep: 1 };
  const step = (x?: number, y?: number): EngineEvent => ({ type: 'ghost.step', ghostId: 'g1', ...(x === undefined ? {} : { x, y }) });

  it('tracks a ghost from spawn to done', () => {
    const s = on(summoned, spawn, step(10, 20), step(30, 40), { type: 'frame', ghostId: 'g1', seq: 2 }, { type: 'rep.finished', rep: 1 });
    expect(s.ghosts.g1).toEqual({ ghostId: 'g1', criterion: '1.2', persona: 'wraith', rep: 1, x: 30, y: 40, trail: [{ x: 10, y: 20 }], done: true, frame: 2 });
  });

  it('keeps only the last 3 trail points', () => {
    const s = on(summoned, spawn, step(1, 1), step(2, 2), step(3, 3), step(4, 4), step(5, 5));
    expect(s.ghosts.g1!.trail).toEqual([{ x: 2, y: 2 }, { x: 3, y: 3 }, { x: 4, y: 4 }]);
  });

  it('a step without a position keeps the old one', () => {
    const s = on(summoned, spawn, step(5, 5), step());
    expect(s.ghosts.g1).toMatchObject({ x: 5, y: 5, trail: [] });
  });

  it('ignores steps and frames for an unknown ghost', () => {
    expect(on(summoned, step(1, 1))).toBe(summoned);
    expect(on(summoned, { type: 'frame', ghostId: 'g9', seq: 0 })).toBe(summoned);
  });
});

describe('reduceAttack: healing', () => {
  const heal = { criterion: '1.2', persona: 'wraith' };

  it('keys a wound by criterion and persona', () => {
    expect(woundKey(heal)).toBe('1.2::wraith');
  });

  it('keeps the open wounds through a heal run', () => {
    const s = reduceAttack(QUIET, { type: 'summoned', origin: 'o', only: null, heal, body: '/tmp/x/revived', wounds: [WOUND], healed: [] });
    expect(s).toMatchObject({ status: 'attacking', heal, body: '/tmp/x/revived', wounds: [WOUND], pulses: [], healed: [] });
  });

  it('folds pulses and the re-raised origin', () => {
    const pulse = (ok: boolean): AttackEvent => ({ type: 'pulse', result: { vital: 'install', ok, detail: '', ms: 1 } });
    const s = [pulse(true), pulse(true), { type: 'reraised', origin: 'http://127.0.0.1:6000' } as AttackEvent].reduce(reduceAttack, reduceAttack(QUIET, sum('o')));
    expect(s.pulses).toHaveLength(2);
    expect(s.origin).toBe('http://127.0.0.1:6000');
  });

  it('records a heal verdict and the healed wounds', () => {
    const s = reduceAttack(reduceAttack(QUIET, sum('o')), { type: 'finished', counts: COUNTS, wounds: [], healed: [WOUND], heal: { ...heal, verdict: 'clean' } });
    expect(s).toMatchObject({ status: 'finished', healVerdict: 'clean', healed: [WOUND], wounds: [] });
  });
});

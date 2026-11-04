import { describe, expect, it } from 'vitest';
import { QUIET, attackOver, reduceAttack, type AttackEvent, type Counts, type Wound } from './attack.js';

const COUNTS: Counts = { haunted: 1, flaky: 0, inconclusive: 0, clean: 1, notApplicable: 0, notRun: 0 };
const WOUND: Wound = { criterion: '1.2', text: 'record only one entry', persona: 'wraith', reason: 'two entries', steps: [], expected: [], failing: [], artifacts: [] };

describe('reduceAttack', () => {
  it('folds a whole attack', () => {
    const log: AttackEvent[] = [
      { type: 'summoned', origin: 'http://127.0.0.1:5555', only: null },
      { type: 'engine', event: { type: 'run.started', criteria: ['1.1', '1.2'], personas: ['wraith', 'banshee', 'lich'], reps: 3 } },
      { type: 'engine', event: { type: 'scout.route', path: '/', status: 'ok' } },
      { type: 'engine', event: { type: 'plan.compiled', criterion: '1.1', persona: 'wraith', status: 'compiled', cached: false } },
      { type: 'engine', event: { type: 'plan.compiled', criterion: '1.2', persona: 'wraith', status: 'compiled', cached: true } },
      { type: 'engine', event: { type: 'verdict.criterion', criterion: '1.2', verdict: 'haunted' } },
      { type: 'finished', counts: COUNTS, wounds: [WOUND] },
    ];
    const s = log.reduce(reduceAttack, QUIET);
    expect(s).toMatchObject({ status: 'finished', origin: 'http://127.0.0.1:5555', routes: 1, planned: 6, plans: 2, verdicts: { '1.2': 'haunted' }, counts: COUNTS });
    expect(s.wounds).toEqual([WOUND]);
    expect(attackOver(log.at(-1)!)).toBe(true);
    expect(attackOver(log[0]!)).toBe(false);
  });

  it('records a failure', () => {
    const s = reduceAttack(reduceAttack(QUIET, { type: 'summoned', origin: 'o', only: null }), { type: 'failed', reason: 'boom' });
    expect(s).toMatchObject({ status: 'failed', failure: 'boom' });
  });

  it('starts fresh on a new summon', () => {
    const done = reduceAttack(QUIET, { type: 'finished', counts: COUNTS, wounds: [WOUND] });
    const s = reduceAttack(done, { type: 'summoned', origin: 'o2', only: ['1.2'] });
    expect(s).toEqual({ ...QUIET, status: 'attacking', origin: 'o2' });
  });
});

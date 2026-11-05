import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { QUIET, type AttackState } from '../../shared/attack';

const attack = (state: AttackState = QUIET, error: string | null = null) => ({ state, summon: async () => {}, error });
import { AttackPanel } from './AttackPanel';

const COUNTS = { haunted: 1, flaky: 0, inconclusive: 1, clean: 4, notApplicable: 0, notRun: 0 };

describe('AttackPanel', () => {
  it('offers to summon Death', () => {
    const html = renderToStaticMarkup(<AttackPanel attack={attack()} />);
    expect(html).toContain('Summon Death');
    expect(html).not.toMatch(/<button[^>]*disabled/);
  });

  it('shows real progress while attacking, with the button disabled', () => {
    const html = renderToStaticMarkup(<AttackPanel attack={attack({ ...QUIET, status: 'attacking', routes: 1, plans: 4, planned: 36 })} />);
    expect(html).toMatch(/<button[^>]*disabled/);
    expect(html).toContain('Scouting… 1 route');
    expect(html).toContain('Plans 4 / 36');
  });

  it('lists each wound as real text', () => {
    const state: AttackState = {
      ...QUIET, status: 'finished', counts: COUNTS,
      wounds: [{ criterion: '1.2', text: 'THE Guestbook SHALL record only one entry.', persona: 'wraith', reason: 'two entries after a double click', steps: [], expected: [], failing: [], artifacts: [] }],
    };
    const html = renderToStaticMarkup(<AttackPanel attack={attack(state)} />);
    expect(html).toContain('1 wound');
    expect(html).toContain('1.2 · wraith');
    expect(html).toContain('THE Guestbook SHALL record only one entry.');
    expect(html).toContain('two entries after a double click');
  });

  it('says so when Death found nothing, with the counts', () => {
    const html = renderToStaticMarkup(<AttackPanel attack={attack({ ...QUIET, status: 'finished', counts: { ...COUNTS, haunted: 0 }, wounds: [] })} />);
    expect(html).toContain('Death found nothing to break');
    expect(html).toContain('4 clean');
    expect(html).toContain('1 inconclusive');
  });

  it('shows why an attack failed', () => {
    const html = renderToStaticMarkup(<AttackPanel attack={attack({ ...QUIET, status: 'failed', failure: 'The LLM client could not be set up' })} />);
    expect(html).toContain('Death faltered: The LLM client could not be set up');
  });

  it('shows a summon error', () => {
    expect(renderToStaticMarkup(<AttackPanel attack={attack(QUIET, 'the ritual has not risen')} />)).toContain('the ritual has not risen');
  });
});

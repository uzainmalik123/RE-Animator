import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { QUIET, type AttackState, type Wound } from '../../shared/attack';
import { AttackPanel, CopyButton } from './AttackPanel';

const attack = (state: AttackState = QUIET, error: string | null = null) => ({ state, summon: async () => {}, error });

// AttackPanel itself has no hooks, so its element tree can be walked to reach handlers and props.
function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...elements(node.props.children as ReactNode)];
}
const textOf = (node: ReactNode): string =>
  Array.isArray(node) ? node.map(textOf).join('') : isValidElement<{ children?: ReactNode }>(node) ? textOf(node.props.children) : node == null || typeof node === 'boolean' ? '' : String(node);

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
      wounds: [{ criterion: '1.2', text: 'THE Guestbook SHALL record only one entry.', persona: 'wraith', reason: 'two entries after a double click', steps: [], expected: [], failing: [], artifacts: [], carried: false }],
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

  describe('healing (R5)', () => {
    const W: Wound = { criterion: '1.2', text: 'record only one entry', persona: 'wraith', reason: 'two entries', steps: ['fill name'], expected: [], failing: [], artifacts: [], carried: false };
    const finished = (extra: Partial<AttackState> = {}): AttackState => ({ ...QUIET, status: 'finished', counts: COUNTS, body: '/tmp/r/revived', wounds: [W], ...extra });

    it('dares Death again on one wound', () => {
      const summon = vi.fn(async () => {});
      const tree = AttackPanel({ attack: { ...attack(finished()), summon } });
      const dare = elements(tree).find((e) => e.type === 'button' && textOf(e.props.children as ReactNode) === 'Dare Death again')!;
      (dare.props.onClick as () => void)();
      expect(summon).toHaveBeenCalledWith({ criterion: '1.2', persona: 'wraith' });
    });

    it('hands each wound a brief for Kiro, and says where to open it', () => {
      const copy = vi.fn(async () => {});
      const tree = AttackPanel({ attack: attack(finished()), copy });
      const btn = elements(tree).find((e) => e.type === CopyButton)!;
      expect(btn.props.text).toMatch(/^Fix acceptance criterion 1\.2/);
      expect(btn.props.copy).toBe(copy);
      expect(renderToStaticMarkup(<AttackPanel attack={attack(finished())} copy={copy} />)).toContain('Open /tmp/r/revived in Kiro');
    });

    it('casts a wound in the grimoire (R7)', () => {
      const onCast = vi.fn();
      const tree = AttackPanel({ attack: attack(finished()), onCast });
      const btn = elements(tree).find((e) => e.type === 'button' && textOf(e.props.children as ReactNode) === 'Cast in the grimoire')!;
      (btn.props.onClick as () => void)();
      expect(onCast).toHaveBeenCalledWith(W);
      expect(elements(AttackPanel({ attack: attack(finished()) })).some((e) => textOf(e.props.children as ReactNode) === 'Cast in the grimoire')).toBe(false);
    });

    it('holds Death back while Kiro is casting (R7)', () => {
      const tree = AttackPanel({ attack: attack(finished()), casting: true });
      const buttons = elements(tree).filter((e) => e.type === 'button' && ['Summon Death', 'Dare Death again'].includes(textOf(e.props.children as ReactNode)));
      expect(buttons).toHaveLength(2);
      for (const b of buttons) expect(b.props.disabled).toBe(true);
    });

    it('offers to copy the brief', () => {
      const copy = vi.fn(async () => {});
      const html = renderToStaticMarkup(<CopyButton text="brief" copy={copy} />);
      expect(html).toContain('Copy for Kiro');
    });

    it('shows a wound that closed, and lists it as healed', () => {
      const html = renderToStaticMarkup(<AttackPanel attack={attack(finished({ wounds: [], healed: [W], heal: { criterion: '1.2', persona: 'wraith' }, healVerdict: 'clean' }))} />);
      expect(html).toContain('The wound closed: Death could not break 1.2 again.');
      expect(html).toMatch(/<li class="healed">[^]*1\.2 · wraith[^]*healed<\/li>/);
    });

    it('says when Death broke it again, or when it is not proven healed', () => {
      const heal = { criterion: '1.2', persona: 'wraith' };
      expect(renderToStaticMarkup(<AttackPanel attack={attack(finished({ heal, healVerdict: 'haunted' }))} />)).toContain('Death broke it again.');
      expect(renderToStaticMarkup(<AttackPanel attack={attack(finished({ heal, healVerdict: 'flaky' }))} />)).toContain('Not proven healed (flaky).');
    });

    it('lists the pulses while Death returns for a wound', () => {
      const pulses = [{ vital: 'install' as const, ok: true, detail: '', ms: 1 }, { vital: 'build' as const, ok: false, detail: '', ms: 1 }];
      const html = renderToStaticMarkup(<AttackPanel attack={attack({ ...QUIET, status: 'attacking', heal: { criterion: '1.2', persona: 'wraith' }, wounds: [W], pulses })} />);
      expect(html).toContain('Death returns for 1.2 · wraith…');
      expect(html).toContain('install ok');
      expect(html).toContain('build failed');
    });
  });
});

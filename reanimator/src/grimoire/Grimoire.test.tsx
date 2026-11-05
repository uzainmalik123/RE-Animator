import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { BLANK, reduceGrimoire, type GrimoireState, type SpellEvent } from '../../shared/grimoire';
import { Grimoire, SpellForm } from './Grimoire';

const HEAL = { criterion: '1.2', persona: 'wraith' };
const fold = (events: SpellEvent[]) => events.reduce(reduceGrimoire, BLANK);
const handle = (state: GrimoireState = BLANK, error: string | null = null) => ({ state, cast: vi.fn(async () => {}), stop: vi.fn(async () => {}), error });
const props = (state: GrimoireState = BLANK, extra: Partial<Parameters<typeof Grimoire>[0]> = {}) => ({ grimoire: handle(state), draft: null, attacking: false, dare: vi.fn(async () => {}), ...extra });

// Grimoire itself has no hooks, so its element tree can be walked to reach handlers and props.
function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...elements(node.props.children as ReactNode)];
}
const textOf = (node: ReactNode): string =>
  Array.isArray(node) ? node.map(textOf).join('') : isValidElement<{ children?: ReactNode }>(node) ? textOf(node.props.children) : node == null || typeof node === 'boolean' ? '' : String(node);
const button = (tree: ReactNode, label: string) => elements(tree).find((e) => e.type === 'button' && textOf(e.props.children as ReactNode) === label);

const WORKED = fold([
  { type: 'cast', text: 'Fix 1.2', heal: HEAL },
  { type: 'quill', text: 'Fixed it.' },
  { type: 'margin', id: 't1', title: 'Reading server.js', status: 'completed' },
  { type: 'ruled', path: 'server.js', oldText: 'a\nb', newText: 'a\nB' },
  { type: 'candle', used: 1200, size: 200000 },
]);

describe('Grimoire', () => {
  it('writes the spell, the quill, the margin notes and the ruled box as real text', () => {
    const html = renderToStaticMarkup(<Grimoire {...props(WORKED)} />);
    expect(html).toContain('The grimoire');
    expect(html).toContain('† Fix 1.2');
    expect(html).toContain('Fixed it.');
    expect(html).toContain('Reading server.js — completed');
    expect(html).toContain('server.js');
    expect(html).toMatch(/class="minus">− b\n</);
    expect(html).toMatch(/class="plus">\+ B\n</);
    expect(html).toContain('99% of the candle left');
    expect(html).not.toContain('<canvas');
  });

  it('leaves the candle unlit until Kiro reports its context', () => {
    expect(renderToStaticMarkup(<Grimoire {...props()} />)).toContain('the candle is unlit: Kiro reported no context');
  });

  it('breaks off a spell being cast', () => {
    const p = props(WORKED);
    (button(Grimoire(p), 'Break off the spell')!.props.onClick as () => void)();
    expect(p.grimoire.stop).toHaveBeenCalled();
  });

  it('seals a finished heal and dares Death on its wound', () => {
    const p = props(reduceGrimoire(WORKED, { type: 'sealed', stopReason: 'end_turn' }));
    const tree = Grimoire(p);
    expect(renderToStaticMarkup(tree)).toContain('Sealed (end_turn).');
    expect(button(tree, 'Break off the spell')).toBeUndefined();
    (button(tree, 'Dare Death again')!.props.onClick as () => void)();
    expect(p.dare).toHaveBeenCalledWith(HEAL);
    expect(button(Grimoire({ ...p, attacking: true }), 'Dare Death again')!.props.disabled).toBe(true);
  });

  it('offers no dare for a spell that was not a heal, or did not end its turn', () => {
    const free = fold([{ type: 'cast', text: 'hi', heal: null }, { type: 'sealed', stopReason: 'end_turn' }]);
    expect(button(Grimoire(props(free)), 'Dare Death again')).toBeUndefined();
    expect(button(Grimoire(props(reduceGrimoire(WORKED, { type: 'sealed', stopReason: 'cancelled' }))), 'Dare Death again')).toBeUndefined();
  });

  it('says why a spell failed, and shows a request error', () => {
    expect(renderToStaticMarkup(<Grimoire {...props(reduceGrimoire(WORKED, { type: 'failed', reason: 'error: not logged in' }))} />)).toContain('The spell failed: error: not logged in');
    expect(renderToStaticMarkup(<Grimoire {...props(BLANK, { grimoire: handle(BLANK, 'Death is attacking; wait for him') })} />)).toContain('Death is attacking; wait for him');
  });

  it('hands the form its draft, and locks it while casting or while Death attacks', () => {
    const draft = { text: 'Fix 1.2', heal: HEAL };
    const form = (p: ReturnType<typeof props>) => elements(Grimoire(p)).find((e) => e.type === SpellForm)!;
    expect(form(props(BLANK, { draft })).props.draft).toBe(draft);
    expect(form(props(BLANK)).props.disabled).toBe(false);
    expect(form(props(WORKED)).props.disabled).toBe(true);
    expect(form(props(BLANK, { attacking: true })).props.disabled).toBe(true);
  });

  it('renders the form seeded with the draft', () => {
    const html = renderToStaticMarkup(<SpellForm draft={{ text: 'Fix 1.2', heal: HEAL }} disabled={false} cast={async () => {}} />);
    expect(html).toContain('Fix 1.2</textarea>');
    expect(html).toContain('Cast');
  });
});

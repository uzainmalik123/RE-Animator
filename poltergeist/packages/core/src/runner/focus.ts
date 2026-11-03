import type { Page } from 'playwright-core';
import type { PlanTarget } from '../compiler/dsl.js';
import { INTERACTIVE_ROLES } from '../scout/aria.js';
import { locateTarget } from '../scout/login.js';

/** The most Tabs one `focus` step presses. Hitting it is inconclusive, never an app bug (D-06, D-48). */
export const MAX_TABS = 100;

export type FocusWalk =
  | { reached: true; tabs: number; editable: boolean; xy?: { x: number; y: number } }
  | { reached: false; why: 'cycle' | 'cap' };

/** Where the page keeps its focus-walk element ids: a registered symbol, so it can't clash with app globals. */
const KEY = 'poltergeist.focus';

/** What Tab can land on natively, plus anything the app opted in. */
const FOCUSABLE = 'a[href],area[href],button,input,select,textarea,summary,iframe,[tabindex],[contenteditable]:not([contenteditable="false"])';

type Probe = { id: number; opaque: boolean; hit: boolean; editable: boolean; xy?: { x: number; y: number } };

// core has no DOM lib, so the page types are written by hand here.
type El = {
  tagName: string;
  isContentEditable?: boolean;
  type?: string;
  parentElement: El | null;
  contains(other: El): boolean;
  closest(selector: string): El | null;
  matches(selector: string): boolean;
  getAttribute(name: string): string | null;
  getBoundingClientRect(): { x: number; y: number; width: number; height: number };
  shadowRoot?: { activeElement: El | null } | null;
};

/**
 * One look at the page (runs in the browser): a stable id for the deepest focused element (through open
 * shadow roots), and whether it reached a match of the target: it is the match, sits inside it, or is the
 * match's nearest focusable ancestor (a link around a text target). A focused wrapper further out, such as
 * `<main tabindex="-1">`, doesn't count. `opaque` focus (an iframe, or a custom element with a closed
 * shadow root) stays on one element while Tab moves inside it, so it never counts as a repeat.
 */
function look(els: El[], { key, focusable }: { key: string; focusable: string }): Probe {
  const g = globalThis as unknown as { document: { activeElement: El | null; body: El; documentElement: El } } & Record<
    symbol,
    { ids: WeakMap<El, number>; next: number } | undefined
  >;
  const doc = g.document;
  const store = (g[Symbol.for(key)] ??= { ids: new WeakMap(), next: 1 });
  let a = doc.activeElement;
  while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
  const el = a ?? doc.body;
  let id = store.ids.get(el);
  if (id === undefined) {
    id = store.next++;
    store.ids.set(el, id);
  }
  const tag = el.tagName;
  const opaque = ['IFRAME', 'FRAME', 'OBJECT', 'EMBED'].includes(tag) || (tag.includes('-') && !el.shadowRoot);
  const root = el === doc.body || el === doc.documentElement;
  const hit = !root && els.some((e) => e === el || e.contains(el) || e.closest(focusable) === el);
  const noText = ['button', 'submit', 'reset', 'checkbox', 'radio', 'file', 'image', 'range', 'color', 'hidden'];
  const editable = tag === 'TEXTAREA' || (tag === 'INPUT' && !noText.includes(el.type ?? '')) || el.isContentEditable === true;
  if (!hit) return { id, opaque, hit, editable };
  const r = el.getBoundingClientRect();
  return { id, opaque, hit, editable, xy: { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) } };
}

/** Whether a match is a control (runs in the browser): it, or an ancestor, is focusable or has an interactive role. */
function isControl(el: El, { focusable, roles }: { focusable: string; roles: string[] }): boolean {
  for (let n: El | null = el; n; n = n.parentElement) {
    if (n.matches(focusable)) return true;
    const role = n.getAttribute('role');
    if (role !== null && roles.includes(role)) return true;
  }
  return false;
}

/**
 * Presses Tab from the current focus until a match of `target` holds focus (F20, D-48). Stops as
 * `cycle` when focus comes back to an element it already passed (the whole page went round), or as
 * `cap` after `MAX_TABS`.
 */
export async function focusWalk(page: Page, target: PlanTarget): Promise<FocusWalk> {
  const loc = locateTarget(page, target);
  const seen = new Set<number>();
  for (let tabs = 0; ; tabs++) {
    const p = await loc.evaluateAll(look as unknown as (els: unknown[], arg: { key: string; focusable: string }) => Probe, { key: KEY, focusable: FOCUSABLE });
    if (p.hit) return { reached: true, tabs, editable: p.editable, ...(p.xy ? { xy: p.xy } : {}) };
    if (!p.opaque) {
      if (seen.has(p.id)) return { reached: false, why: 'cycle' };
      seen.add(p.id);
    }
    if (tabs === MAX_TABS) return { reached: false, why: 'cap' };
    await page.keyboard.press('Tab');
  }
}

/** Whether a missed target is a keyboard bug: some match is a visible, enabled control. Never throws. */
export async function probeReachable(page: Page, target: PlanTarget): Promise<'visible' | 'missing'> {
  const arg = { focusable: FOCUSABLE, roles: [...INTERACTIVE_ROLES] };
  try {
    for (const m of await locateTarget(page, target).all()) {
      if (!(await m.isVisible()) || !(await m.isEnabled())) continue;
      if (await m.evaluate(isControl as unknown as (el: unknown, a: typeof arg) => boolean, arg)) return 'visible';
    }
  } catch {
    // a closed or navigating page: not provably the app's fault
  }
  return 'missing';
}

import type { Page } from 'playwright-core';
import type { PlanTarget } from '../compiler/dsl.js';
import { locateTarget } from '../scout/login.js';

/** The most Tabs one `focus` step presses. Hitting it is inconclusive, never an app bug (D-06, D-48). */
export const MAX_TABS = 100;

export type FocusWalk = { reached: true; tabs: number; xy?: { x: number; y: number } } | { reached: false; why: 'cycle' | 'cap' };

/** Where the page keeps its focus-walk element ids: a registered symbol, so it can't clash with app globals. */
const KEY = 'poltergeist.focus';

type Probe = { id: number; hit: boolean; xy?: { x: number; y: number } };

// core has no DOM lib, so the page types are written by hand here.
type El = {
  contains(other: El): boolean;
  getBoundingClientRect(): { x: number; y: number; width: number; height: number };
  shadowRoot?: { activeElement: El | null } | null;
};

/**
 * One look at the page: a stable id for the deepest focused element (through shadow roots) and whether it
 * is, contains, or sits inside a match of the target. Runs in the browser.
 */
function look(els: El[], key: string): Probe {
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
  const root = el === doc.body || el === doc.documentElement;
  const hit = els.some((e) => e === el || e.contains(el) || (!root && el.contains(e)));
  if (!hit) return { id, hit };
  const r = el.getBoundingClientRect();
  return { id, hit, xy: { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) } };
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
    const p = await loc.evaluateAll(look as unknown as (els: unknown[], key: string) => Probe, KEY);
    if (p.hit) return { reached: true, tabs, ...(p.xy ? { xy: p.xy } : {}) };
    if (seen.has(p.id)) return { reached: false, why: 'cycle' };
    seen.add(p.id);
    if (tabs === MAX_TABS) return { reached: false, why: 'cap' };
    await page.keyboard.press('Tab');
  }
}

/** Whether a missed target is a keyboard bug: some match is visible and enabled. Never throws. */
export async function probeReachable(page: Page, target: PlanTarget): Promise<'visible' | 'missing'> {
  try {
    for (const m of await locateTarget(page, target).all()) {
      if ((await m.isVisible()) && (await m.isEnabled())) return 'visible';
    }
  } catch {
    // a closed or navigating page: not provably the app's fault
  }
  return 'missing';
}

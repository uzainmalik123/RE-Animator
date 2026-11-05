// The grimoire's protocol (R7, D-R21): what the backend streams while Kiro works on the revived body,
// and the one reducer both sides fold it with (THEME §8). A spell is the user's prompt; Kiro's reply
// is quill writing, its tools are margin notes, its edits are ruled boxes, a finished turn is a seal.
// Everything is from Kiro's real stream (D-R11): the candle burns only from a usage report it sent.
import type { HealTarget } from './attack.js';

export type SpellEvent =
  // `heal` is the wound this spell was cast for (from its brief), so a seal can dare Death on it.
  | { type: 'cast'; text: string; heal: HealTarget | null }
  | { type: 'quill'; text: string }
  | { type: 'margin'; id: string; title: string; status: string }
  | { type: 'ruled'; path: string; oldText: string; newText: string }
  | { type: 'candle'; used: number; size: number }
  | { type: 'sealed'; stopReason: string }
  | { type: 'failed'; reason: string };

export type RuledLine = { sign: '-' | '+'; text: string };

export type Page =
  | { kind: 'spell'; text: string }
  | { kind: 'quill'; text: string }
  | { kind: 'margin'; id: string; title: string; status: string }
  | { kind: 'ruled'; path: string; lines: RuledLine[] };

export interface GrimoireState {
  status: 'idle' | 'casting' | 'sealed' | 'failed';
  pages: Page[];
  heal: HealTarget | null;
  candle: { used: number; size: number } | null;
  stopReason: string | null;
  failure: string | null;
}

export const BLANK: GrimoireState = { status: 'idle', pages: [], heal: null, candle: null, stopReason: null, failure: null };

export const spellOver = (e: SpellEvent): boolean => e.type === 'sealed' || e.type === 'failed';

// An edit at a glance: the old middle as − lines, the new middle as + lines, once the lines both
// texts share at the head and the tail are dropped. Not a diff tool.
export function ruledLines(oldText: string, newText: string): RuledLine[] {
  const a = oldText === '' ? [] : oldText.split('\n');
  const b = newText === '' ? [] : newText.split('\n');
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
  return [
    ...a.slice(head, a.length - tail).map((text) => ({ sign: '-' as const, text })),
    ...b.slice(head, b.length - tail).map((text) => ({ sign: '+' as const, text })),
  ];
}

export function reduceGrimoire(s: GrimoireState, e: SpellEvent): GrimoireState {
  switch (e.type) {
    case 'cast':
      return { ...s, status: 'casting', heal: e.heal, stopReason: null, failure: null, pages: [...s.pages, { kind: 'spell', text: e.text }] };
    case 'quill': {
      const last = s.pages.at(-1);
      if (last?.kind === 'quill') return { ...s, pages: [...s.pages.slice(0, -1), { kind: 'quill', text: last.text + e.text }] };
      return { ...s, pages: [...s.pages, { kind: 'quill', text: e.text }] };
    }
    case 'margin': {
      const at = s.pages.findIndex((p) => p.kind === 'margin' && p.id === e.id);
      if (at < 0) return { ...s, pages: [...s.pages, { kind: 'margin', id: e.id, title: e.title, status: e.status }] };
      const old = s.pages[at] as Extract<Page, { kind: 'margin' }>;
      const pages = [...s.pages];
      pages[at] = { ...old, title: e.title || old.title, status: e.status };
      return { ...s, pages };
    }
    case 'ruled':
      return { ...s, pages: [...s.pages, { kind: 'ruled', path: e.path, lines: ruledLines(e.oldText, e.newText) }] };
    case 'candle':
      return { ...s, candle: { used: e.used, size: e.size } };
    case 'sealed':
      return { ...s, status: 'sealed', stopReason: e.stopReason };
    case 'failed':
      return { ...s, status: 'failed', failure: e.reason };
  }
}

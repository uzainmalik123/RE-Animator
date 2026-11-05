import { QUIET, reduceAttack, type AttackEvent, type AttackState } from '../../shared/attack';
import { BLANK, reduceGrimoire, type GrimoireState, type SpellEvent } from '../../shared/grimoire';
import type { RecordedLine } from '../../shared/recording';
import { IDLE, reduceRitual, type RitualEvent, type RitualState } from '../../shared/ritual';

// R11 (D-R22): a recording replays through the same reducers the live hooks use, so the replay is
// the real UI on real events. Only the clock is the replay's own: long pauses are shortened.

export const MAX_GAP_MS = 2000;

// When each line plays, in ms from the start: real gaps, each capped at maxGap, never backwards.
export function schedule(lines: RecordedLine[], maxGap = MAX_GAP_MS): number[] {
  let at = 0;
  return lines.map((l, i) => {
    if (i > 0) at += Math.min(Math.max(0, l.t - lines[i - 1]!.t), maxGap);
    return at;
  });
}

export type Session = {
  ritual: { id: string | null; state: RitualState };
  attack: { id: string | null; state: AttackState };
  spell: { id: string | null; state: GrimoireState };
};

export const EMPTY_SESSION: Session = { ritual: { id: null, state: IDLE }, attack: { id: null, state: QUIET }, spell: { id: null, state: BLANK } };

// Fold one line, with the hooks' rules: a new ritual starts everything afresh, a new attack starts
// from QUIET, and every spell folds onto the same book.
export function step(s: Session, line: RecordedLine): Session {
  switch (line.stream) {
    case 'ritual': {
      const base = line.id === s.ritual.id ? s : { ...EMPTY_SESSION, ritual: { id: line.id, state: IDLE } };
      return { ...base, ritual: { id: line.id, state: reduceRitual(base.ritual.state, line.event as RitualEvent) } };
    }
    case 'attack': {
      const from = line.id === s.attack.id ? s.attack.state : QUIET;
      return { ...s, attack: { id: line.id, state: reduceAttack(from, line.event as AttackEvent) } };
    }
    case 'spell':
      return { ...s, spell: { id: line.id, state: reduceGrimoire(s.spell.state, line.event as SpellEvent) } };
  }
}

export const foldTo = (lines: RecordedLine[], n: number): Session => lines.slice(0, n).reduce(step, EMPTY_SESSION);

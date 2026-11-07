import type { RitualTarget } from '../raise/ritualClient';

// Which scene the app is in (R6): the graveyard (with the grave Kiro is walking to, if any) or the
// raise. Pure, so the hand-over rules can be tested without a screen or a clock. The ritual itself
// never waits on this: it starts the moment a grave is chosen, and the walk is only a transition.
export type View = { at: 'graveyard'; chosen: string | null } | { at: 'raise' };

export const GRAVEYARD: View = { at: 'graveyard', chosen: null };
export const RAISE: View = { at: 'raise' };

// The backend answered a choice. A refusal changes nothing (the reason is shown, no walk). A prepared
// grave sends Kiro walking to its stone, unless the viewer prefers reduced motion; a URL grave has
// no stone, so it goes straight to the raise.
export function afterStart(view: View, target: RitualTarget | undefined, accepted: boolean, reduceMotion: boolean): View {
  if (!accepted) return view;
  if (target && 'grave' in target && !reduceMotion) return { at: 'graveyard', chosen: target.grave };
  return RAISE;
}

// Kiro has reached the stone: the raise takes the stage. Anything else stays where it is.
export function walked(view: View): View {
  return view.at === 'graveyard' && view.chosen !== null ? RAISE : view;
}

// Is Kiro walking right now?
export const walkingTo = (view: View): string | null => (view.at === 'graveyard' ? view.chosen : null);

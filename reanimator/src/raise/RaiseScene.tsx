import { useEffect, useState } from 'react';
import type { RitualState } from '../../shared/ritual';
import { useAttack } from '../attack/useAttack';
import { GRAVEYARD, RAISE, afterStart, walked, walkingTo, type View } from '../graveyard/flow';
import { Graveyard } from '../graveyard/Graveyard';
import { WALK_MS } from '../graveyard/scene';
import { useGraveyard } from '../graveyard/useGraveyard';
import { useGrimoire } from '../grimoire/useGrimoire';
import { RaiseView } from './RaiseView';
import type { RitualTarget } from './ritualClient';
import { useRitual } from './useRitual';

// The live app: the graveyard (R6) first, then the backend's ritual, Death and the grimoire, all on
// one ritual, fed to the view. `initial` pins the ritual's state and the raise scene (tests).
export function RaiseScene({ initial }: { initial?: RitualState } = {}) {
  const live = useRitual();
  const attack = useAttack(live.id);
  const grimoire = useGrimoire(live.id);
  const [view, setView] = useState<View>(initial ? RAISE : GRAVEYARD);
  const [returned, setReturned] = useState(false);
  const graveyard = useGraveyard(view.at === 'graveyard');
  const [starting, setStarting] = useState(false);
  const walking = walkingTo(view);

  // Kiro takes WALK_MS to reach the stone; then the raise takes the stage. Only a transition: the
  // ritual started the moment the grave was chosen and does not wait for it (D-R11).
  useEffect(() => {
    if (walking === null) return;
    const timer = setTimeout(() => setView(walked), WALK_MS);
    return () => clearTimeout(timer);
  }, [walking]);

  const raise = async (target: RitualTarget) => {
    setStarting(true);
    const accepted = await live.start(target);
    setStarting(false);
    setView((v) => afterStart(v, target, accepted, matchMedia('(prefers-reduced-motion: reduce)').matches));
  };

  if (view.at === 'graveyard') {
    return <Graveyard graves={graveyard.graves} loadError={graveyard.error} error={live.error} chosen={walking} busy={starting || walking !== null} focusHeading={returned} onRaise={(t) => void raise(t)} />;
  }
  const leave = () => {
    live.reset();
    setReturned(true);
    setView(GRAVEYARD);
  };
  return <RaiseView ritual={{ ...live, state: initial ?? live.state }} attack={attack} grimoire={grimoire} onLeave={leave} />;
}

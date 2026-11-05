import type { RitualState } from '../../shared/ritual';
import { useAttack } from '../attack/useAttack';
import { useGrimoire } from '../grimoire/useGrimoire';
import { RaiseView } from './RaiseView';
import { useRitual } from './useRitual';

// The live app: the backend's ritual, Death and the grimoire, all on one ritual, fed to the view.
// `initial` pins the ritual's state (tests).
export function RaiseScene({ initial }: { initial?: RitualState } = {}) {
  const live = useRitual();
  const attack = useAttack(live.id);
  const grimoire = useGrimoire(live.id);
  return <RaiseView ritual={{ ...live, state: initial ?? live.state }} attack={attack} grimoire={grimoire} />;
}

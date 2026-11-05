import { useState } from 'react';
import { woundKey, type AttackState, type Counts, type Wound } from '../../shared/attack';
import { healBrief } from '../../shared/heal';
import type { AttackHandle } from './useAttack';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function countsLine(c: Counts): string {
  return (['haunted', 'flaky', 'inconclusive', 'clean', 'notApplicable'] as const)
    .filter((k) => c[k] > 0)
    .map((k) => `${c[k]} ${k === 'notApplicable' ? 'not applicable' : k}`)
    .join(' · ');
}

type Copy = (text: string) => Promise<void>;
const clipboard: Copy = (text) => navigator.clipboard.writeText(text);

// R5: copies a wound's heal brief, for the user to hand to Kiro (Reanimator never drives Kiro).
export function CopyButton({ text, copy }: { text: string; copy: Copy }) {
  const [said, setSaid] = useState<string | null>(null);
  const onClick = () => copy(text).then(() => setSaid('copied'), () => setSaid('copy failed'));
  return (
    <button type="button" onClick={() => void onClick()}>
      {said ?? 'Copy for Kiro'}
    </button>
  );
}

// What the last heal proved (D-R20): only a clean pair that really ran closes the wound.
function healLine(s: AttackState): { text: string; healed: boolean } | null {
  if (!s.heal || s.healVerdict === null) return null;
  if (s.healVerdict === 'clean') return { text: `The wound closed: Death could not break ${s.heal.criterion} again.`, healed: true };
  if (s.healVerdict === 'haunted') return { text: 'Death broke it again.', healed: false };
  return { text: `Not proven healed (${s.healVerdict}).`, healed: false };
}

// R3: Death's attack as real text, under the risen app. The art (minions, wounds drawn as dots) is
// R4's (AttackScene, on the same state); this shows only what the engine really reported (D-R11).
// R5 adds the heal: a brief per wound for Kiro, Dare Death again on it, and the wounds it closed.
// R7: a wound can be cast in the grimoire (Kiro drives the heal), and Death waits while Kiro casts.
// No hooks here (CopyButton holds its own), so tests can walk the tree.
export function AttackPanel({
  attack,
  copy = clipboard,
  onCast,
  casting = false,
}: {
  attack: Pick<AttackHandle, 'state' | 'summon' | 'error'>;
  copy?: Copy;
  onCast?: (w: Wound) => void;
  casting?: boolean;
}) {
  const state = attack.state;
  const attacking = state.status === 'attacking';
  const locked = attacking || casting;
  const healed = healLine(state);
  const wound = (w: Wound) => (
    <li key={woundKey(w)} className="wound">
      <b>
        {w.criterion} · {w.persona}
      </b>{' '}
      — {w.text}
      <div className="detail">{w.reason}</div>
      {state.body && <CopyButton text={healBrief(w, state.body)} copy={copy} />}
      {state.body && onCast && (
        <button type="button" onClick={() => onCast(w)}>
          Cast in the grimoire
        </button>
      )}
      <button type="button" disabled={locked} onClick={() => void attack.summon({ criterion: w.criterion, persona: w.persona })}>
        Dare Death again
      </button>
    </li>
  );

  return (
    <section className="attack-panel" aria-live="polite">
      <h2>Death</h2>
      <button type="button" disabled={locked} onClick={() => void attack.summon()}>
        Summon Death
      </button>
      {attack.error && <p className="flat">{attack.error}</p>}
      {attacking && state.heal && (
        <p>
          Death returns for {state.heal.criterion} · {state.heal.persona}…
        </p>
      )}
      {attacking && state.pulses.length > 0 && (
        <ul className="pulses">
          {state.pulses.map((p) => (
            <li key={p.vital} className={p.ok ? undefined : 'flat'}>
              {p.vital} {p.ok ? 'ok' : 'failed'}
            </li>
          ))}
        </ul>
      )}
      {attacking && (
        <p>
          Scouting… {plural(state.routes, 'route')} · Plans {state.plans} / {state.planned}
        </p>
      )}
      {state.status === 'failed' && state.failure && <p className="flat">Death faltered: {state.failure}</p>}
      {healed && <p className={healed.healed ? 'healed' : 'flat'}>{healed.text}</p>}
      {state.status === 'finished' && state.counts && (
        <p className={state.wounds.length > 0 ? 'flat' : undefined}>
          {state.wounds.length > 0 ? plural(state.wounds.length, 'wound') : 'Death found nothing to break'} · {countsLine(state.counts)}
        </p>
      )}
      {state.body && state.wounds.length > 0 && <p className="detail">Open {state.body} in Kiro, paste a wound's brief, then dare Death again.</p>}
      {(state.wounds.length > 0 || state.healed.length > 0) && (
        <ul className="wounds">
          {state.wounds.map(wound)}
          {state.healed.map((w) => (
            <li key={woundKey(w)} className="healed">
              <b>
                {w.criterion} · {w.persona}
              </b>{' '}
              — {w.text} — healed
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

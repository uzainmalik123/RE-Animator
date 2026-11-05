import type { Counts } from '../../shared/attack';
import type { AttackHandle } from './useAttack';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function countsLine(c: Counts): string {
  return (['haunted', 'flaky', 'inconclusive', 'clean', 'notApplicable'] as const)
    .filter((k) => c[k] > 0)
    .map((k) => `${c[k]} ${k === 'notApplicable' ? 'not applicable' : k}`)
    .join(' · ');
}

// R3: Death's attack as real text, under the risen app. The art (minions, wounds drawn as dots) is
// R4's (AttackScene, on the same state); this shows only what the engine really reported (D-R11).
export function AttackPanel({ attack }: { attack: Pick<AttackHandle, 'state' | 'summon' | 'error'> }) {
  const state = attack.state;
  const attacking = state.status === 'attacking';

  return (
    <section className="attack-panel" aria-live="polite">
      <h2>Death</h2>
      <button type="button" disabled={attacking} onClick={() => void attack.summon()}>
        Summon Death
      </button>
      {attack.error && <p className="flat">{attack.error}</p>}
      {attacking && (
        <p>
          Scouting… {plural(state.routes, 'route')} · Plans {state.plans} / {state.planned}
        </p>
      )}
      {state.status === 'failed' && state.failure && <p className="flat">Death faltered: {state.failure}</p>}
      {state.status === 'finished' && state.counts && (
        <>
          <p className={state.wounds.length > 0 ? 'flat' : undefined}>
            {state.wounds.length > 0 ? plural(state.wounds.length, 'wound') : 'Death found nothing to break'} · {countsLine(state.counts)}
          </p>
          <ul className="wounds">
            {state.wounds.map((w) => (
              <li key={`${w.criterion}-${w.persona}`} className="wound">
                <b>
                  {w.criterion} · {w.persona}
                </b>{' '}
                — {w.text}
                <div className="detail">{w.reason}</div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

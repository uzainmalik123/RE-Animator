import { useRef, useState } from 'react';
import { VITALS, beats, flatlined, type RitualState, type VitalResult } from '../../shared/ritual';
import type { AttackState } from '../../shared/attack';
import { AttackPanel } from '../attack/AttackPanel';
import { AttackScene } from '../attack/AttackScene';
import { showsAttack } from '../attack/scene';
import { useAttack } from '../attack/useAttack';
import { healBrief } from '../../shared/heal';
import { Grimoire, type Draft } from '../grimoire/Grimoire';
import { useGrimoire } from '../grimoire/useGrimoire';
import { useDotCanvas } from '../render/useDotCanvas';
import { circleLuminance, monitorLuminance } from './scene';
import { useRitual } from './useRitual';

const firstLine = (s: string) => s.split('\n').find((l) => l.trim() !== '')?.trim() ?? '';

function monitorLabel(s: RitualState): string {
  const n = beats(s);
  if (s.status === 'failed') return `Heart monitor: stalled at ${n} of ${VITALS.length} vitals`;
  if (n > 0) return `Heart monitor: ${n} of ${VITALS.length} vitals beating`;
  return flatlined(s) ? `Heart monitor: flatline, the corpse failed ${s.corpse.find((v) => !v.ok)!.vital}` : 'Heart monitor: flatline';
}

function circlePower(s: RitualState): number {
  if (s.status === 'idle') return 0.1;
  return Math.max(0.25, beats(s) / VITALS.length);
}

function VitalLine({ name, result }: { name: string; result: VitalResult | undefined }) {
  const mark = result === undefined ? '·' : result.ok ? '✓' : '✗';
  const cls = result === undefined ? 'pending' : result.ok ? 'beat' : 'flat';
  return (
    <li className={cls}>
      <span className="mark">{mark}</span> {name}
      {result && <span className="ms"> {result.ms} ms</span>}
      {result && firstLine(result.detail) && <div className="detail">{firstLine(result.detail)}</div>}
    </li>
  );
}

// The raise's stage: its own component, so its canvas loops live exactly as long as its canvases
// (they stop while Death holds the stage, and draw afresh when it comes back).
function RaiseStage({ state }: { state: RitualState }) {
  const circleRef = useRef<HTMLCanvasElement>(null);
  const monitorRef = useRef<HTMLCanvasElement>(null);
  const power = circlePower(state);
  const beating = beats(state) > 0;

  useDotCanvas(circleRef, 'magic', (c, r, t) => circleLuminance(c, r, { tMs: t, power }), [power]);
  useDotCanvas(monitorRef, beating ? 'magic' : 'death', (c, r, t) => monitorLuminance(c, r, { tMs: t, beating }), [beating]);

  return (
    <div className="raise-stage">
      <canvas ref={circleRef} className="raise-circle" aria-label={`Spell circle, ${state.status === 'idle' ? 'unlit' : `burning at ${Math.round(power * 100)}%`}`} />
      <canvas ref={monitorRef} className="raise-monitor" aria-label={monitorLabel(state)} />
    </div>
  );
}

// R2: the ritual. A spell circle (magic) that burns brighter with each real vital, and a heart
// monitor that is a red flatline until the revived repo's first vital truly passes. All the facts
// are real text in the panel.
export function RaiseScene({ initial }: { initial?: RitualState } = {}) {
  const live = useRitual();
  const state = initial ?? live.state;
  const attack = useAttack(live.id);
  const attackState: AttackState = attack.state;
  // R7: the grimoire on the same ritual; a wound's brief becomes the spell's draft.
  const grimoire = useGrimoire(live.id);
  const [draft, setDraft] = useState<Draft | null>(null);
  const casting = grimoire.state.status === 'casting';
  const running = state.status === 'examining' || state.status === 'raising';


  return (
    <div className="raise">
      {!showsAttack({ id: attack.id, state: attackState }) ? (
        <RaiseStage state={state} />
      ) : (
        // R4: once Death is summoned, the stage is his (a fresh scene per attack).
        <AttackScene key={attack.id ?? 'none'} state={attackState} attackId={attack.id} />
      )}
      <section className="raise-panel" aria-live="polite">
        <h1>{state.repo ?? 'A dead repo waits'}</h1>
        {state.diedIn !== null && <p className="died">died {state.diedIn}</p>}
        <button type="button" disabled={running} onClick={() => void live.start()}>
          Begin the ritual
        </button>
        {live.error && <p className="flat">{live.error}</p>}
        {state.corpse.length > 0 && (
          <>
            <h2>The corpse</h2>
            <ol>
              {state.corpse.map((r) => (
                <VitalLine key={r.vital} name={r.vital} result={r} />
              ))}
            </ol>
          </>
        )}
        {(state.status === 'raising' || state.revived.length > 0) && (
          <>
            <h2>The raise</h2>
            <ol>
              {VITALS.map((v) => (
                <VitalLine key={v} name={v} result={state.revived.find((r) => r.vital === v)} />
              ))}
            </ol>
          </>
        )}
        {state.status === 'failed' && state.failure && <p className="flat">The ritual stalled: {state.failure}</p>}
        {state.status === 'risen' && state.origin && (
          <>
            <p className="beat">
              It lives: <a href={state.origin}>{state.origin}</a>
            </p>
            <iframe className="raise-app" title="The revived app" src={state.origin} />
            <AttackPanel
              attack={attack}
              casting={casting}
              onCast={(w) => attackState.body && setDraft({ text: healBrief(w, attackState.body), heal: { criterion: w.criterion, persona: w.persona } })}
            />
            <Grimoire grimoire={grimoire} draft={draft} attacking={attackState.status === 'attacking'} dare={attack.summon} />
          </>
        )}
      </section>
    </div>
  );
}

import { useRef, useState, type FormEvent } from 'react';
import type { Headstone } from '../../shared/graveyard';
import { useDotCanvas } from '../render/useDotCanvas';
import type { RitualTarget } from '../raise/ritualClient';
import { kiroLuminance, stonesLuminance } from './scene';

// R9: what the grave field sends; an empty field raises nothing.
export function graveRequest(text: string): string | null {
  const t = text.trim();
  return t === '' ? null : t;
}

function stoneLabel(g: Headstone): string {
  return `${g.name}, died ${g.diedIn}, ${g.licence}. ${g.chart ? 'Death can attack it.' : 'No chart: Death cannot attack it.'}`;
}

export interface GraveyardProps {
  // null while the backend has not answered yet.
  graves: Headstone[] | null;
  // Why the list could not load.
  loadError: string | null;
  // Why the last ritual was refused.
  error: string | null;
  // The id of the chosen grave while Kiro walks to it.
  chosen: string | null;
  // A ritual is being started, or Kiro is walking: nothing else can be chosen.
  busy: boolean;
  onRaise: (target: RitualTarget) => void;
}

// The opening scene (R6, THEME §5.1): the dead repos as headstones in the fog, Kiro waiting at the
// edge, and the same choices as real buttons beneath. The canvases are the costume; the buttons and
// the text are what can be read, focused and pressed.
export function Graveyard({ graves, loadError, error, chosen, busy, onRaise }: GraveyardProps) {
  const stonesRef = useRef<HTMLCanvasElement>(null);
  const kiroRef = useRef<HTMLCanvasElement>(null);
  // When the walk began, in the animation clock: the first frame drawn after a stone is chosen.
  const walkFrom = useRef<number | null>(null);
  const [grave, setGrave] = useState('');

  const list = graves ?? [];
  const n = list.length;
  const target = chosen === null ? null : list.findIndex((g) => g.id === chosen);
  const index = target === null || target < 0 ? null : target;

  useDotCanvas(stonesRef, 'bone', (c, r, t) => stonesLuminance(c, r, { tMs: t, n, chosen: index }), [n, index]);
  useDotCanvas(
    kiroRef,
    'magic',
    (c, r, t) => {
      walkFrom.current = index === null ? null : (walkFrom.current ?? t);
      return kiroLuminance(c, r, { tMs: t, n, target: index, walkMs: walkFrom.current === null ? 0 : t - walkFrom.current });
    },
    [n, index],
  );
  const dig = (e: FormEvent) => {
    e.preventDefault();
    const url = graveRequest(grave);
    if (url && !busy) onRaise({ repo: url });
  };

  const scene = index === null ? `The graveyard: ${n === 0 ? 'no headstones' : `${n} headstone${n === 1 ? '' : 's'}`}, Kiro waits` : `Kiro walks to the headstone of ${list[index]!.name}`;

  return (
    <div className="raise graveyard">
      <div className="graveyard-stage">
        <canvas ref={stonesRef} className="graveyard-canvas" aria-label={scene} />
        <canvas ref={kiroRef} className="graveyard-canvas" aria-label="Kiro, your familiar" />
      </div>
      <section className="raise-panel" aria-live="polite">
        <h1>The graveyard</h1>
        <p className="died">Choose a dead repo. Kiro will fetch the body.</p>
        {loadError && <p className="graveyard-note">{loadError}</p>}
        {!loadError && graves === null && <p className="graveyard-note">The graveyard is waking…</p>}
        {graves !== null && n === 0 && <p className="graveyard-note">No one is buried here yet.</p>}
        {n > 0 && (
          <ul className="stones">
            {list.map((g) => (
              <li key={g.id}>
                <button type="button" className={g.id === chosen ? 'stone chosen' : 'stone'} disabled={busy} aria-label={stoneLabel(g)} onClick={() => onRaise({ grave: g.id })}>
                  <span className="stone-name">{g.name}</span>
                  <span className="stone-meta">
                    died {g.diedIn} · {g.licence}
                  </span>
                  <span className="stone-meta">{g.chart ? 'Death can attack it' : 'no chart: Death cannot attack it'}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="graveyard-note">{error}</p>}
        <h2>Dig a new grave</h2>
        <form onSubmit={dig}>
          <label className="grave">
            Name a grave (GitHub URL)
            <input type="url" value={grave} placeholder="https://github.com/owner/repo" disabled={busy} onChange={(e) => setGrave(e.target.value)} />
          </label>
          <button type="submit" disabled={busy || graveRequest(grave) === null}>
            Raise this grave
          </button>
        </form>
      </section>
    </div>
  );
}

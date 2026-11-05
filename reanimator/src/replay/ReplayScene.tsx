import { useEffect, useState, type ReactNode } from 'react';
import { FrameUrlContext } from '../frames';
import { RaiseView } from '../raise/RaiseView';
import { loadRecording, recordingBase, replayFrameUrl, type Loaded } from './load';
import { SPEEDS, usePlayer, type Player } from './usePlayer';

const noop = async () => {};

// R11 (D-R22): a recorded real run, played in the real UI. It says it is a replay, every control is
// locked, and with no recording published it says so instead of playing anything (D-R11).
export function ReplayScene() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  useEffect(() => {
    void loadRecording((url) => fetch(url)).then(setLoaded);
  }, []);
  return loaded && 'lines' in loaded ? <Playing loaded={loaded} /> : <ReplayView loaded={loaded} />;
}

function Playing({ loaded }: { loaded: Extract<Loaded, { lines: unknown }> }) {
  return <ReplayView loaded={loaded} player={usePlayer(loaded.lines)} />;
}

export function ReplayView({ loaded, player }: { loaded: Loaded | null; player?: Player }) {
  if (!loaded) return <Notice title="Opening the recording…" />;
  if ('missing' in loaded) return <Notice title="No recording yet">A real run hasn&apos;t been recorded yet, and this page only shows real runs.</Notice>;
  if ('error' in loaded) return <Notice title="The recording can't be played">{loaded.error}</Notice>;
  if (!player) return <Notice title="Opening the recording…" />;

  const { session } = player;
  const date = loaded.manifest.recordedAt.slice(0, 10);
  return (
    <div className="replay">
      <header className="replay-banner" role="note">
        <span>RECORDED RUN · replay of a real run on {date} · nothing here is live · pauses longer than 2 s are shortened</span>
        <span className="replay-controls">
          <button type="button" onClick={player.toggle}>
            {player.playing ? 'Pause' : 'Play'}
          </button>
          {SPEEDS.map((s) => (
            <button key={s} type="button" aria-pressed={player.speed === s} onClick={() => player.setSpeed(s)}>
              {s}×
            </button>
          ))}
          <button type="button" onClick={player.restart}>
            Restart
          </button>
          <span className="replay-count">
            {player.n} / {player.total}
          </span>
        </span>
      </header>
      <FrameUrlContext.Provider value={replayFrameUrl(recordingBase())}>
        <RaiseView
          ritual={{ id: session.ritual.id, state: session.ritual.state, start: noop, error: null }}
          attack={{ id: session.attack.id, state: session.attack.state, summon: noop, error: null }}
          grimoire={{ id: session.spell.id, state: session.spell.state, cast: noop, stop: noop, error: null }}
          replay={{ recordedAt: loaded.manifest.recordedAt }}
        />
      </FrameUrlContext.Provider>
    </div>
  );
}

function Notice({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <main className="replay-notice">
      <h1>{title}</h1>
      {children && <p>{children}</p>}
    </main>
  );
}

import { useState, type KeyboardEvent } from 'react';
import type { HealTarget } from '../../shared/attack';
import type { GrimoireState, Page } from '../../shared/grimoire';
import type { GrimoireHandle } from './useGrimoire';
import { Quill } from './Quill';

export type Draft = { text: string; heal: HealTarget | null };

// The spell being written. Enter casts it, Shift+Enter is a new line; a blank spell is never cast.
export function SpellForm({ draft, disabled, cast }: { draft: Draft | null; disabled: boolean; cast: GrimoireHandle['cast'] }) {
  const [text, setText] = useState(draft?.text ?? '');
  const send = () => {
    if (disabled || text.trim() === '') return;
    void cast(text, draft?.heal ?? undefined);
    setText('');
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    e.preventDefault();
    send();
  };
  return (
    <form
      className="spell-form"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <textarea aria-label="Your spell" placeholder="Write a spell for Kiro…" value={text} disabled={disabled} onChange={(e) => setText(e.target.value)} onKeyDown={onKeyDown} />
      <button type="submit" disabled={disabled}>
        Cast
      </button>
    </form>
  );
}

function PageView({ page }: { page: Page }) {
  switch (page.kind) {
    case 'spell':
      return <p className="spell">† {page.text}</p>;
    case 'quill':
      return <Quill text={page.text} />;
    case 'margin':
      return (
        <aside className="margin">
          {page.title} — {page.status}
        </aside>
      );
    case 'ruled':
      return (
        <figure className="ruled">
          <figcaption>{page.path}</figcaption>
          <pre>
            {page.lines.map((l, i) => (
              <span key={i} className={l.sign === '-' ? 'minus' : 'plus'}>
                {`${l.sign === '-' ? '−' : '+'} ${l.text}\n`}
              </span>
            ))}
          </pre>
        </figure>
      );
  }
}

function candleLine(c: GrimoireState['candle']): string {
  if (!c || c.size <= 0) return 'the candle is unlit: Kiro reported no context';
  return `${Math.max(0, Math.round(100 * (1 - c.used / c.size)))}% of the candle left`;
}

// R7: the grimoire (THEME §8), where the user directs Kiro on the revived body. All real text, from
// Kiro's real stream (D-R11). A heal's seal offers Dare Death again on its wound (R5's re-run).
// No hooks here (SpellForm and Quill hold their own), so tests can walk the tree.
export function Grimoire({
  grimoire,
  draft,
  attacking,
  dare,
}: {
  grimoire: Pick<GrimoireHandle, 'state' | 'cast' | 'stop' | 'error'>;
  draft: Draft | null;
  attacking: boolean;
  dare: (heal: HealTarget) => Promise<void>;
}) {
  const s = grimoire.state;
  const casting = s.status === 'casting';
  const heal = s.status === 'sealed' && s.stopReason === 'end_turn' ? s.heal : null;
  return (
    <section className="grimoire" aria-live="polite">
      <h2>The grimoire</h2>
      <p className="candle">{candleLine(s.candle)}</p>
      <div className="pages">
        {s.pages.map((p, i) => (
          <PageView key={i} page={p} />
        ))}
      </div>
      {casting && (
        <button type="button" onClick={() => void grimoire.stop()}>
          Break off the spell
        </button>
      )}
      {s.status === 'sealed' && <p className="seal">Sealed ({s.stopReason}).</p>}
      {heal && (
        <button type="button" disabled={attacking} onClick={() => void dare(heal)}>
          Dare Death again
        </button>
      )}
      {s.status === 'failed' && <p className="flat">The spell failed: {s.failure}</p>}
      {grimoire.error && <p className="flat">{grimoire.error}</p>}
      <SpellForm key={draft?.text ?? ''} draft={draft} disabled={casting || attacking} cast={grimoire.cast} />
    </section>
  );
}

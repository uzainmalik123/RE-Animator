import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { parseLines } from '../../shared/recording';
import session from './fixtures/session.ndjson?raw';
import { foldTo } from './timeline';
import type { Player } from './usePlayer';
import { ReplayView } from './ReplayScene';

// A synthetic session, for tests only: it is never published (D-R11, D-R22).
const lines = parseLines(session);
const manifest = { format: 'reanimator-recording', version: 1, recordedAt: '2026-11-20T10:00:00Z' } as const;
const noop = () => {};
const player = (n: number): Player => ({ session: foldTo(lines, n), n, total: lines.length, playing: true, speed: 2, toggle: noop, setSpeed: noop, restart: noop });

describe('ReplayView (R11)', () => {
  it('says plainly when no run has been recorded, and plays nothing', () => {
    const html = renderToStaticMarkup(<ReplayView loaded={{ missing: true }} />);
    expect(html).toContain('No recording yet');
    expect(html).not.toContain('<fieldset');
    expect(html).not.toContain('Begin the ritual');
  });

  it('shows why a recording could not be played', () => {
    expect(renderToStaticMarkup(<ReplayView loaded={{ error: 'the recording is damaged: bad recording line 3' }} />)).toContain('bad recording line 3');
  });

  it('waits while the recording opens', () => {
    expect(renderToStaticMarkup(<ReplayView loaded={null} />)).toContain('Opening the recording');
  });

  it('labels a recording as a replay and plays it in the real, locked UI', () => {
    const html = renderToStaticMarkup(<ReplayView loaded={{ manifest, lines }} player={player(lines.length)} />);
    expect(html).toContain('RECORDED RUN · replay of a real run on 2026-11-20 · nothing here is live · pauses longer than 2 s are shortened');
    expect(html).toMatch(/<fieldset[^>]*disabled/);
    expect(html).toContain('guestbook-2016');
    expect(html).toContain('The revived app ran at http://127.0.0.1:5001 on the recording machine.');
    expect(html).toContain(`${lines.length} / ${lines.length}`);
    expect(html).toMatch(/aria-pressed="true"[^>]*>2×/);
    expect(html).not.toContain('<iframe');
  });
});

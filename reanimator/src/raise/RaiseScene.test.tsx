import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { IDLE, type RitualState } from '../../shared/ritual';
import { RaiseScene } from './RaiseScene';

const vital = (v: 'install' | 'build' | 'serve' | 'render', ok = true, detail = '') => ({ vital: v, ok, detail, ms: 12 });
const base: RitualState = { ...IDLE, repo: 'guestbook-2016', diedIn: 2016, corpse: [vital('install', false, 'npm error code EBADENGINE')] };

describe('RaiseScene', () => {
  it('idles with the button, labelled canvases and no app yet', () => {
    const html = renderToStaticMarkup(<RaiseScene />);
    expect(html).not.toContain('Summon Death');
    expect(html).toContain('Begin the ritual');
    expect(html).toMatch(/<canvas[^>]*aria-label="Spell circle[^"]*"/);
    expect(html).toMatch(/<canvas[^>]*aria-label="Heart monitor: flatline[^"]*"/);
    expect(html).not.toContain('<iframe');
  });

  it('shows the corpse failing as real text', () => {
    const html = renderToStaticMarkup(<RaiseScene initial={{ ...base, status: 'raising' }} />);
    expect(html).toContain('guestbook-2016');
    expect(html).toContain('died 2016');
    expect(html).toContain('EBADENGINE');
    expect(html).toMatch(/<button[^>]*disabled/);
  });

  it('shows the risen app with all four beats', () => {
    const risen: RitualState = {
      ...base,
      status: 'risen',
      revived: [vital('install'), vital('build'), vital('serve'), vital('render')],
      origin: 'http://127.0.0.1:5001',
    };
    const html = renderToStaticMarkup(<RaiseScene initial={risen} />);
    expect(html).toContain('<iframe');
    expect(html).toContain('src="http://127.0.0.1:5001"');
    expect(html).toContain('title="The revived app"');
    expect(html).toMatch(/aria-label="Heart monitor: 4 of 4 vitals beating"/);
    for (const v of ['install', 'build', 'serve', 'render']) expect(html).toContain(v);
    expect(html).toContain('Summon Death');
  });

  it('says why the ritual failed', () => {
    const failed: RitualState = { ...base, status: 'failed', revived: [vital('install'), vital('serve', false)], failure: 'serve: the app exited (code 1) before answering' };
    const html = renderToStaticMarkup(<RaiseScene initial={failed} />);
    expect(html).toContain('serve: the app exited (code 1) before answering');
    expect(html).toMatch(/aria-label="Heart monitor: stalled at 1 of 4[^"]*"/);
    expect(html).not.toContain('<iframe');
  });
});

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { QUIET } from '../../shared/attack';
import { BLANK } from '../../shared/grimoire';
import { IDLE, type RitualState } from '../../shared/ritual';
import { art } from '../art';
import { RaiseView, graveRequest } from './RaiseView';

const vital = (v: 'install' | 'build' | 'serve' | 'render') => ({ vital: v, ok: true, detail: '', ms: 12 });
const risen: RitualState = { ...IDLE, repo: 'guestbook-2016', diedIn: 2016, status: 'risen', revived: [vital('install'), vital('build'), vital('serve'), vital('render')], origin: 'http://127.0.0.1:5001' };
const noop = async () => {};
const handles = {
  ritual: { state: risen, id: 'r1', start: noop, error: null },
  attack: { id: null, state: QUIET, summon: noop, error: null },
  grimoire: { id: null, state: BLANK, cast: noop, stop: noop, error: null },
};

describe('RaiseView (R11)', () => {
  it('in replay, shows where the app ran instead of framing it, and locks every control', () => {
    const html = renderToStaticMarkup(<RaiseView {...handles} replay={{ recordedAt: '2026-11-20T10:00:00Z' }} />);
    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('href="http://127.0.0.1:5001"');
    expect(html).toContain('replay-note');
    expect(html).toContain('The revived app ran at http://127.0.0.1:5001 on the recording machine.');
    expect(html).toMatch(/<fieldset[^>]*disabled/);
  });

  it('live, frames the revived app and locks nothing', () => {
    const html = renderToStaticMarkup(<RaiseView {...handles} />);
    expect(html).toContain('<iframe');
    expect(html).not.toContain('<fieldset');
  });
});

describe('RaiseView (R9)', () => {
  it('offers a field to name a grave', () => {
    const html = renderToStaticMarkup(<RaiseView {...handles} ritual={{ ...handles.ritual, state: IDLE }} />);
    expect(html).toContain('Name a grave (GitHub URL)');
    expect(html).toContain('placeholder="https://github.com/owner/repo"');
  });

  it('lists the rites a grave was given', () => {
    const html = renderToStaticMarkup(<RaiseView {...handles} ritual={{ ...handles.ritual, state: { ...risen, rites: ['engines', 'openssl'] } }} />);
    expect(html).toContain('The rites');
    expect(html).toContain('engines');
    expect(html).toContain('openssl');
  });

  it('shows no rites for our own corpse', () => {
    expect(renderToStaticMarkup(<RaiseView {...handles} />)).not.toContain('The rites');
  });

  it('sends a named grave, and nothing for an empty field', () => {
    expect(graveRequest('  https://github.com/a/b ')).toBe('https://github.com/a/b');
    expect(graveRequest('   ')).toBeUndefined();
  });
});

describe('art (R11)', () => {
  it('resolves art under the base path, so a sub-path host finds it', () => {
    expect(art('death.svg')).toBe(`${import.meta.env.BASE_URL}art/death.svg`);
    expect(art('death.svg').endsWith('/art/death.svg')).toBe(true);
  });
});

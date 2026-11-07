import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Headstone } from '../../shared/graveyard';
import { Graveyard, graveRequest, type GraveyardProps } from './Graveyard';

const STONES: Headstone[] = [
  { id: 'tally-2014', name: 'tally-2014', diedIn: 2014, licence: 'MIT', chart: true },
  { id: 'sundial-2015', name: 'sundial-2015', diedIn: 2015, licence: 'MIT', chart: false },
  { id: 'practice-corpse', name: 'guestbook-2016', diedIn: 2016, licence: 'MIT', chart: true },
];
const base: GraveyardProps = { graves: STONES, loadError: null, error: null, chosen: null, busy: false, onRaise: () => {} };
const html = (o: Partial<GraveyardProps> = {}) => renderToStaticMarkup(<Graveyard {...base} {...o} />);

describe('graveRequest', () => {
  it('trims the URL and treats an empty field as nothing', () => {
    expect(graveRequest('  https://github.com/a/b ')).toBe('https://github.com/a/b');
    expect(graveRequest('   ')).toBeNull();
    expect(graveRequest('')).toBeNull();
  });
});

describe('Graveyard', () => {
  it('has a real button for every headstone, in a list', () => {
    const out = html();
    expect(out).toContain('<ul class="stones">');
    expect(out.match(/<button type="button" class="stone"/g)).toHaveLength(3);
  });

  it('reads each headstone as text: name, year, licence and whether Death can attack', () => {
    const out = html();
    expect(out).toContain('died 2014 · MIT');
    expect(out).toContain('Death can attack it');
    expect(out).toContain('no chart: Death cannot attack it');
    expect(out).toContain('aria-label="tally-2014, died 2014, MIT. Death can attack it."');
    expect(out).toContain('aria-label="sundial-2015, died 2015, MIT. No chart: Death cannot attack it."');
  });

  it('gives every canvas an aria-label', () => {
    const canvases = html().match(/<canvas[^>]*>/g) ?? [];
    expect(canvases).toHaveLength(2);
    for (const c of canvases) expect(c).toMatch(/aria-label="[^"]+"/);
    expect(html()).toContain('The graveyard: 3 headstones, Kiro waits');
  });

  it('says it is waking while the list loads, with no buttons to press', () => {
    const out = html({ graves: null });
    expect(out).toContain('The graveyard is waking');
    expect(out).not.toContain('class="stone"');
  });

  it('says why the list could not load', () => {
    expect(html({ graves: null, loadError: 'the backend is not answering (npm run server)' })).toContain('the backend is not answering (npm run server)');
    expect(html({ graves: null, loadError: 'x' })).not.toContain('waking');
  });

  it('says so when no one is buried, and still offers a new grave', () => {
    const out = html({ graves: [] });
    expect(out).toContain('No one is buried here yet');
    expect(out).toContain('Dig a new grave');
    expect(out).toContain('The graveyard: no headstones, Kiro waits');
  });

  it('names a lone headstone in the singular', () => {
    expect(html({ graves: [STONES[0]!] })).toContain('1 headstone, Kiro');
  });

  it('shows why a ritual was refused, and stays open', () => {
    const out = html({ error: 'a ritual is already running' });
    expect(out).toContain('a ritual is already running');
    expect(out).toContain('class="stones"');
  });

  it('follows Kiro to the chosen headstone and locks everything else', () => {
    const out = html({ chosen: 'sundial-2015', busy: true });
    expect(out).toContain('Kiro walks to the headstone of sundial-2015');
    expect(out).toContain('class="stone chosen"');
    expect(out.match(/<button[^>]*disabled/g)?.length).toBe(4);
  });

  it('keeps the R9 field, with the raise button off while it is empty', () => {
    const out = html();
    expect(out).toContain('Name a grave (GitHub URL)');
    expect(out).toContain('placeholder="https://github.com/owner/repo"');
    expect(out).toMatch(/<button type="submit" disabled="">Raise this grave/);
  });

  it('never uses Death\'s red: no wound or flat class', () => {
    const out = html({ error: 'x', loadError: 'y' });
    expect(out).not.toMatch(/class="[^"]*\b(flat|wound|death)\b/);
  });
});

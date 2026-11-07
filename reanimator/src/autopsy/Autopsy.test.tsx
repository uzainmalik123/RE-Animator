import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Autopsy as AutopsyData } from '../../shared/autopsy';
import { Autopsy } from './Autopsy';

const data: AutopsyData = {
  diedAt: 'build',
  symptom: 'TypeError: util.print is not a function',
  skipped: 2,
  causes: [
    {
      kind: 'removed-api',
      title: 'Removed Node API: util.print',
      why: 'Node removed this API.',
      file: 'build.js',
      lines: [
        { op: ' ', text: 'var stamp = 1;' },
        { op: '-', text: "util.print('stamped');" },
        { op: '+', text: "process.stdout.write('stamped');" },
      ],
      truncated: true,
      seen: true,
    },
    { kind: 'engine-pin', title: 'Pinned to an old Node', why: 'It pinned.', file: 'package.json', lines: [], truncated: false, seen: false },
  ],
};
const html = (a: AutopsyData = data) => renderToStaticMarkup(<Autopsy repo="sundial-2015" autopsy={a} />);

describe('Autopsy (R8)', () => {
  it('reads the cause of death as real text: the vital and the symptom', () => {
    const out = html();
    expect(out).toContain('The autopsy');
    expect(out).toContain('Died at build: TypeError: util.print is not a function');
  });

  it('shows each cause: title, why, file, whether the flatline named it', () => {
    const out = html();
    expect(out).toContain('Removed Node API: util.print');
    expect(out).toContain('Node removed this API.');
    expect(out).toContain('<code>build.js</code>');
    expect(out).toContain("named in the corpse&#x27;s real failing output");
    expect(out).toContain("not named in the corpse&#x27;s failing output");
  });

  it('draws the evidence in a ruled box with − and + markers, not colour alone', () => {
    const out = html();
    expect(out).toContain('class="ruled"');
    expect(out).toContain('−');
    expect(out).toContain("util.print(&#x27;stamped&#x27;);");
    expect(out).toContain('class="ln add"');
    expect(out).toContain('class="ln del"');
    expect(out).toContain('Evidence truncated');
    expect(out).toContain('2 items left out');
  });

  it('says the body keeps its secret when no cause was found', () => {
    const out = html({ ...data, causes: [], skipped: 0 });
    expect(out).toContain('keeps its secret');
    expect(out).not.toContain('class="cause"');
  });

  it('a corpse that never failed is said plainly', () => {
    expect(html({ ...data, diedAt: null, symptom: '' })).toContain('No vital failed on the corpse');
  });

  it('escapes hostile text from a recording', () => {
    const out = html({ ...data, symptom: '<script>alert(1)</script>', causes: [{ ...data.causes[0]!, title: '<img src=x>', lines: [{ op: '+', text: '<script>x</script>' }] }] });
    expect(out).not.toContain('<script>');
    expect(out).not.toContain('<img src=x>');
  });

  it('gives the slab an aria-label that counts the causes, and offers a copy button', () => {
    const out = html();
    expect(out).toMatch(/<canvas[^>]*aria-label="Autopsy slab: 2 causes found"/);
    expect(out).toContain('role="img"');
    expect(html({ ...data, causes: [], skipped: 0 })).toContain('Autopsy slab: no cause found');
    expect(out).toMatch(/<button type="button"[^>]*>Copy autopsy<\/button>/);
    expect(out).not.toMatch(/<button[^>]*aria-label/);
  });
});

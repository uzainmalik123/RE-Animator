import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseHouseRules, readHouseRules } from '../../src/steering/rules.js';

const doc = (...rules: string[]) => ['---', 'inclusion: always', '---', '', '# Poltergeist', '', '## House rules', '', ...rules, ''].join('\n');
const parse = (...rules: string[]) => parseHouseRules(doc(...rules), '/p/poltergeist.md');

describe('parseHouseRules', () => {
  it('reads disabled personas, case-insensitive and deduped in input order', () => {
    const { rules, warnings } = parse('- disable: Banshee, lich', '- disable: banshee');
    expect(rules.disabled).toEqual(['banshee', 'lich']);
    expect(warnings).toEqual([]);
  });

  it('reads forbid rules with the method upper-cased', () => {
    expect(parse('- forbid: delete /api/admin*').rules.forbidden).toEqual([{ method: 'DELETE', path: '/api/admin*' }]);
    expect(parse('- forbid: * /logout').rules.forbidden).toEqual([{ method: '*', path: '/logout' }]);
  });

  it('warns on a malformed forbid rule and adds nothing', () => {
    const { rules, warnings } = parse('- forbid: GET admin');
    expect(rules.forbidden).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/line 9/);
    expect(warnings[0]).toMatch(/forbid/);
  });

  it('reads route notes, joining two notes on one path', () => {
    const { rules } = parse('- note /checkout: Pay stays disabled until the cart has items.', '- note /checkout: Then it turns green.');
    expect(rules.notes).toEqual([{ path: '/checkout', text: 'Pay stays disabled until the cart has items. Then it turns green.' }]);
  });

  it('warns on a note over 500 characters, or with a bad path', () => {
    const { rules, warnings } = parse(`- note /x: ${'a'.repeat(501)}`, '- note checkout: hi');
    expect(rules.notes).toEqual([]);
    expect(warnings).toHaveLength(2);
  });

  it('warns on unknown keys and unknown personas, keeping the known ones', () => {
    const { rules, warnings } = parse('- colour: red', '- disable: wizard, wraith');
    expect(rules.disabled).toEqual(['wraith']);
    expect(warnings.some((w) => w.includes('unknown house rule "colour"'))).toBe(true);
    expect(warnings.some((w) => w.includes('unknown persona "wizard"'))).toBe(true);
  });

  it('ignores rules outside the section and inside HTML comments', () => {
    const md = [
      '## Tools', '- disable: wraith', '',
      '## House rules', '<!--', '- disable: banshee', '-->', '- disable: lich', 'Some prose.', '',
      '## Later', '- disable: revenant',
    ].join('\n');
    expect(parseHouseRules(md, 'p').rules.disabled).toEqual(['lich']);
  });

  it('keeps line numbers right after a multi-line comment', () => {
    const md = ['## House rules', '<!--', 'a', '-->', '- nope: x'].join('\n');
    expect(parseHouseRules(md, 'p').warnings[0]).toMatch(/line 5/);
  });

  it('finds the heading with different case, trailing spaces and CRLF endings', () => {
    const md = ['# P', '## House Rules  ', '- disable: banshee', ''].join('\r\n');
    expect(parseHouseRules(md, 'p').rules.disabled).toEqual(['banshee']);
  });

  it('reads * and + bullets, tabs after the bullet and backticked values (F17 review I2)', () => {
    const { rules, warnings } = parse('* forbid: DELETE /api/admin*', '-\tdisable: lich', '+ forbid: `POST /api/x`', '- `disable: wraith`');
    expect(rules.forbidden).toEqual([{ method: 'DELETE', path: '/api/admin*' }, { method: 'POST', path: '/api/x' }]);
    expect(rules.disabled).toEqual(['lich', 'wraith']);
    expect(warnings).toEqual([]);
  });

  it('returns empty rules and no warnings without a section', () => {
    expect(parseHouseRules('# Hi\n\n- disable: banshee\n', 'p')).toEqual({
      rules: { path: 'p', disabled: [], forbidden: [], notes: [] },
      warnings: [],
    });
  });
});

describe('readHouseRules', () => {
  it('returns path null and no warnings when there is no steering file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pg-steer-'));
    expect(await readHouseRules(dir)).toEqual({ rules: { path: null, disabled: [], forbidden: [], notes: [] }, warnings: [] });
  });

  it('reads the steering file under .kiro/steering', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pg-steer-'));
    await mkdir(join(dir, '.kiro', 'steering'), { recursive: true });
    const file = join(dir, '.kiro', 'steering', 'poltergeist.md');
    await writeFile(file, doc('- disable: banshee'));
    const { rules } = await readHouseRules(dir);
    expect(rules.path).toBe(file);
    expect(rules.disabled).toEqual(['banshee']);
  });

  it('warns and returns empty rules when the file cannot be read', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pg-steer-'));
    await mkdir(join(dir, '.kiro', 'steering', 'poltergeist.md'), { recursive: true });
    const { rules, warnings } = await readHouseRules(dir);
    expect(rules).toEqual({ path: null, disabled: [], forbidden: [], notes: [] });
    expect(warnings).toHaveLength(1);
  });
});

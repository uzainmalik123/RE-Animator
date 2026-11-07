import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FIXTURES_DIR, graveDir, listGraves } from './graveyard.js';

async function fixture(root: string, dir: string, m: object, o: { chart?: boolean } = {}): Promise<void> {
  const base = join(root, dir);
  await mkdir(join(base, 'corpse'), { recursive: true });
  await mkdir(join(base, 'remedy'), { recursive: true });
  await writeFile(join(base, 'manifest.json'), JSON.stringify(m));
  if (o.chart) {
    await mkdir(join(base, 'chart'));
    await writeFile(join(base, 'chart', 'requirements.md'), '# r');
  }
}

const m = (name: string, diedIn: number) => ({ name, diedIn, licence: 'MIT', serve: ['node', 'a.js'] });

describe('listGraves', () => {
  it('lists the fixtures oldest death first, and says which have a chart', async () => {
    const root = await mkdtemp(join(tmpdir(), 'graves-'));
    await fixture(root, 'b-grave', m('b', 2016), { chart: true });
    await fixture(root, 'a-grave', m('a', 2016));
    await fixture(root, 'old-grave', m('old', 2010));
    expect(await listGraves(root)).toEqual([
      { id: 'old-grave', name: 'old', diedIn: 2010, licence: 'MIT', chart: false },
      { id: 'a-grave', name: 'a', diedIn: 2016, licence: 'MIT', chart: false },
      { id: 'b-grave', name: 'b', diedIn: 2016, licence: 'MIT', chart: true },
    ]);
  });

  it('skips a broken manifest, a stray file and a directory that is not a plain name', async () => {
    const root = await mkdtemp(join(tmpdir(), 'graves-'));
    await fixture(root, 'good', m('good', 2015));
    await fixture(root, 'broken', { name: 'broken' });
    await fixture(root, 'Not_Plain', m('x', 2015));
    await mkdir(join(root, 'empty'));
    await writeFile(join(root, 'README.md'), 'hi');
    expect((await listGraves(root)).map((s) => s.id)).toEqual(['good']);
  });

  it('is empty, not an error, when there is no fixtures folder', async () => {
    expect(await listGraves(join(tmpdir(), 'reanimator-no-such-folder'))).toEqual([]);
  });

  it('lists the real prepared graves, oldest death first, each with a chart', async () => {
    const stones = await listGraves();
    expect(stones.map((s) => s.id)).toEqual(['tally-2014', 'sundial-2015', 'practice-corpse']);
    expect(stones.map((s) => s.name)).toEqual(['tally-2014', 'sundial-2015', 'guestbook-2016']);
    expect(stones.every((s) => s.chart && s.licence === 'MIT')).toBe(true);
  });
});

describe('graveDir', () => {
  it('finds a listed grave', async () => {
    expect(await graveDir('practice-corpse')).toBe(join(FIXTURES_DIR, 'practice-corpse'));
  });

  it('never leaves the fixtures folder, and refuses what is not listed', async () => {
    for (const id of ['../fixtures', '..', '.', '', 'a/b', 'nope', '__proto__', 'PRACTICE-CORPSE']) expect(await graveDir(id)).toBeNull();
  });

  it('refuses a directory whose manifest is broken', async () => {
    const root = await mkdtemp(join(tmpdir(), 'graves-'));
    await fixture(root, 'broken', { name: 'broken' });
    expect(await graveDir('broken', root)).toBeNull();
  });
});

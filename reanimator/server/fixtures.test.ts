import { existsSync } from 'node:fs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PRACTICE_CORPSE, loadFixture } from './fixtures.js';

describe('loadFixture', () => {
  it('loads the practice corpse', async () => {
    const f = await loadFixture(PRACTICE_CORPSE);
    expect(f.name).toBe('guestbook-2016');
    expect(f.diedIn).toBe(2016);
    expect(f.licence).toBe('MIT');
    expect(f.serve).toEqual(['node', 'server.js']);
    expect(existsSync(f.corpseDir)).toBe(true);
    expect(existsSync(f.remedyDir)).toBe(true);
  });

  it('names the bad field', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'fixture-'));
    await writeFile(join(dir, 'manifest.json'), JSON.stringify({ name: 'x', diedIn: 2016, licence: 'MIT' }));
    await expect(loadFixture(dir)).rejects.toThrow(/serve/);
  });

  it('rejects a fixture without a corpse folder', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'fixture-'));
    await writeFile(join(dir, 'manifest.json'), JSON.stringify({ name: 'x', diedIn: 2016, licence: 'MIT', serve: ['node', 'a.js'] }));
    await expect(loadFixture(dir)).rejects.toThrow(/corpse/);
  });
});

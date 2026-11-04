import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { prepareAttack } from './chart.js';
import { PRACTICE_CORPSE, loadFixture } from './fixtures.js';

async function setup() {
  const root = await mkdtemp(join(tmpdir(), 'r3-chart-'));
  const revivedDir = join(root, 'revived');
  await mkdir(revivedDir);
  return { root, revivedDir, homeRoot: join(root, 'home'), fixture: await loadFixture(PRACTICE_CORPSE) };
}

describe('prepareAttack', () => {
  it('copies the chart into the revived repo and aims the config at its origin', async () => {
    const { revivedDir, homeRoot, fixture } = await setup();
    const p = await prepareAttack({ fixture, revivedDir, origin: 'http://127.0.0.1:5555', homeRoot });
    expect(p.specDir).toBe(join(revivedDir, '.kiro', 'specs', 'chart'));
    expect(existsSync(join(p.specDir, 'requirements.md'))).toBe(true);
    expect(p.home).toBe(join(homeRoot, 'guestbook-2016'));
    expect(p.configPath).toBe(join(p.home, 'poltergeist.config.json'));
    expect(JSON.parse(await readFile(p.configPath, 'utf8'))).toEqual({
      target: 'http://127.0.0.1:5555', routes: [{ path: '/', auth: false }], concurrency: 6, reps: 3,
    });
  });

  it('keeps the revived repo\'s chart on a second attack (the report merges beside it)', async () => {
    const { revivedDir, homeRoot, fixture } = await setup();
    const first = await prepareAttack({ fixture, revivedDir, origin: 'http://127.0.0.1:5555', homeRoot });
    await writeFile(join(first.specDir, 'requirements.md'), 'edited');
    const again = await prepareAttack({ fixture, revivedDir, origin: 'http://127.0.0.1:6666', homeRoot });
    expect(await readFile(join(again.specDir, 'requirements.md'), 'utf8')).toBe('edited');
    expect(JSON.parse(await readFile(again.configPath, 'utf8')).target).toBe('http://127.0.0.1:6666');
  });

  it('refuses a fixture with no chart', async () => {
    const { revivedDir, homeRoot, fixture } = await setup();
    await expect(prepareAttack({ fixture: { ...fixture, chartDir: null }, revivedDir, origin: 'http://127.0.0.1:1', homeRoot })).rejects.toThrow('fixture guestbook-2016 has no chart');
  });
});

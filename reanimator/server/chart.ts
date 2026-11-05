// Getting a fixture ready for Death (R3, D-R16). The chart (its spec) is copied into the revived repo
// at .kiro/specs/chart/, where the report lands and a re-run merges (Poltergeist F14), and where Kiro
// will see it when healing (R5). The config and the engine's .poltergeist/ home (plan cache, runs)
// live in a persistent per-fixture folder, so cached plans outlive each ritual's temp dir; the plan
// cache key has no origin in it, so a new random port still hits it.
import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Fixture } from './fixtures.js';

// A laptop-sized run: every persona (the engine's default), 3 reps so verdicts must reproduce.
const CONCURRENCY = 6;
const REPS = 3;

// Where the chart (and the engine's report beside it) lives in a revived repo.
export const chartDir = (revivedDir: string): string => join(revivedDir, '.kiro', 'specs', 'chart');

export async function prepareAttack(o: { fixture: Fixture; revivedDir: string; origin: string; homeRoot: string }): Promise<{ specDir: string; configPath: string; home: string }> {
  const { fixture } = o;
  if (!fixture.chartDir) throw new Error(`fixture ${fixture.name} has no chart`);
  const specDir = chartDir(o.revivedDir);
  await mkdir(specDir, { recursive: true });
  const spec = join(specDir, 'requirements.md');
  const present = await access(spec).then(() => true, () => false);
  if (!present) await copyFile(join(fixture.chartDir, 'requirements.md'), spec);

  const routes: unknown = JSON.parse(await readFile(join(fixture.chartDir, 'routes.json'), 'utf8'));
  const home = join(o.homeRoot, fixture.name);
  await mkdir(home, { recursive: true });
  const configPath = join(home, 'poltergeist.config.json');
  // Death only attacks the app we revived: the target is always the ritual's loopback origin (D-R7).
  await writeFile(configPath, `${JSON.stringify({ target: o.origin, routes, concurrency: CONCURRENCY, reps: REPS }, null, 2)}\n`);
  return { specDir, configPath, home };
}

// The rites (R9, D-R23): the remedy for a grave nobody prepared. Four fixed cures for the commonest
// ways a JS repo dies on Node 22, each applied only when its symptom is in the files, and each named
// in the ritual so nothing is hidden. Code-level rot is Kiro's work in the grimoire, not a rite's.
import { lstat, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readOwn } from './own-file.js';

export const RITES = ['engines', 'node-sass', 'openssl', 'lockfile'] as const;
export type Rite = (typeof RITES)[number];

type Deps = Record<string, string>;
type Pkg = Record<string, unknown> & { engines?: Record<string, string>; dependencies?: Deps; devDependencies?: Deps };

const SECTIONS = ['dependencies', 'devDependencies'] as const;
const SASS = '^1.77.0';

// A .npmrc as lines, with set/remove by key that keep every other line as it was.
class Npmrc {
  constructor(private lines: string[]) {}
  private key = (l: string) => l.split('=')[0]!.trim();
  get(k: string): string | undefined {
    const line = this.lines.find((l) => this.key(l) === k);
    return line?.slice(line.indexOf('=') + 1).trim();
  }
  set(k: string, v: string): void {
    if (this.get(k) !== v) this.lines = [...this.lines.filter((l) => this.key(l) !== k), `${k}=${v}`];
  }
  remove(k: string): void {
    this.lines = this.lines.filter((l) => this.key(l) !== k);
  }
  text(): string {
    return this.lines.map((l) => `${l}\n`).join('');
  }
}

// The first number of a version range ("^4.46.0" → 4); NaN for a tag or URL.
const major = (range: string) => Number.parseInt(range.replace(/^[\s^~>=<v]*/, ''), 10);

const depVersion = (pkg: Pkg, name: string): string | undefined => SECTIONS.map((s) => pkg[s]?.[name]).find((v) => typeof v === 'string');

// Runs on the host, so it never reads or writes through a symlink the grave planted (readOwn).
export async function applyRites(dir: string): Promise<Rite[]> {
  const pkgPath = join(dir, 'package.json');
  const raw = await readOwn(pkgPath);
  if (raw === null) return [];
  let pkg: Pkg;
  try {
    pkg = JSON.parse(raw) as Pkg;
    if (typeof pkg !== 'object' || pkg === null || Array.isArray(pkg)) return [];
  } catch {
    return [];
  }
  const rcPath = join(dir, '.npmrc');
  // A symlinked .npmrc is dropped, so writing ours can't land on what it points at.
  if ((await lstat(rcPath).catch(() => null))?.isSymbolicLink()) await rm(rcPath);
  const rcRaw = await readOwn(rcPath);
  const rc = new Npmrc(rcRaw === null ? [] : rcRaw.split('\n').filter((l) => l.trim() !== ''));
  const applied: Rite[] = [];

  if (pkg.engineStrict === true || rc.get('engine-strict') === 'true') {
    delete pkg.engineStrict;
    if (pkg.engines) delete pkg.engines.node;
    rc.remove('engine-strict');
    applied.push('engines');
  }

  for (const s of SECTIONS) {
    const deps = pkg[s];
    if (deps && 'node-sass' in deps) {
      delete deps['node-sass'];
      deps.sass = SASS;
      if (!applied.includes('node-sass')) applied.push('node-sass');
    }
  }

  if (['webpack', 'react-scripts'].some((n) => major(depVersion(pkg, n) ?? '') < 5)) {
    rc.set('node-options', '--openssl-legacy-provider');
    applied.push('openssl');
  }

  const lockPath = join(dir, 'package-lock.json');
  const lockRaw = await readOwn(lockPath);
  if (lockRaw !== null) {
    let version: unknown;
    try {
      version = (JSON.parse(lockRaw) as { lockfileVersion?: unknown }).lockfileVersion;
    } catch {
      version = undefined;
    }
    if (version === undefined || version === 1) {
      await rm(lockPath);
      rc.set('legacy-peer-deps', 'true');
      applied.push('lockfile');
    }
  }

  if (applied.some((r) => r === 'engines' || r === 'node-sass')) await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  if (applied.some((r) => r !== 'node-sass')) await writeFile(rcPath, rc.text());
  return applied;
}

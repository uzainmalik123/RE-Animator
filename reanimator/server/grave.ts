// A stranger's grave (R9, D-R23): a dead repo named by its GitHub URL, cloned shallow into the
// ritual's work dir. The URL is checked strictly before anything runs; the clone never runs hooks,
// fetches submodules or prompts for a password, and a grave too big to raise is refused.
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { childEnv } from './env.js';
import type { runCommand } from './exec.js';

export const MAX_GRAVE_BYTES = 104_857_600;
const CLONE_TIMEOUT_MS = 60_000;

const OWNER = /^[A-Za-z0-9-]{1,39}$/;
const REPO = /^[A-Za-z0-9._-]{1,100}$/;

// Only https://github.com/<owner>/<repo>, with an optional .git or trailing slash.
export function parseGraveUrl(s: string): { owner: string; repo: string; url: string } | null {
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || u.hostname !== 'github.com' || u.port || u.username || u.password || u.search || u.hash) return null;
  const parts = u.pathname.replace(/\/$/, '').split('/').slice(1);
  if (parts.length !== 2) return null;
  const owner = parts[0]!;
  const repo = parts[1]!.replace(/\.git$/, '');
  if (!OWNER.test(owner) || !REPO.test(repo) || repo === '.' || repo === '..') return null;
  return { owner, repo, url: `https://github.com/${owner}/${repo}.git` };
}

async function sizeOf(dir: string): Promise<number> {
  let total = 0;
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name === '.git') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) total += await sizeOf(p);
    else if (e.isFile()) total += (await stat(p)).size;
  }
  return total;
}

const firstLine = (s: string) => s.split('\n').find((l) => l.trim() !== '')?.trim() ?? '';

async function licenceOf(dir: string): Promise<string> {
  try {
    const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8')) as { license?: unknown };
    return typeof pkg.license === 'string' && pkg.license !== '' ? pkg.license : 'unknown';
  } catch {
    return 'unknown';
  }
}

export async function cloneGrave(
  url: string,
  dest: string,
  o: { run: typeof runCommand; signal?: AbortSignal; maxBytes?: number },
): Promise<{ ok: true; diedIn: number; licence: string } | { ok: false; reason: string }> {
  const env = childEnv(process.env, { GIT_TERMINAL_PROMPT: '0' });
  const argv = ['git', '-c', 'core.hooksPath=/dev/null', 'clone', '--depth', '1', '--no-recurse-submodules', '--single-branch', '--', url, dest];
  const r = await o.run(argv, { cwd: process.cwd(), timeoutMs: CLONE_TIMEOUT_MS, env, signal: o.signal });
  if (r.code !== 0) return { ok: false, reason: `clone: ${r.timedOut ? `timed out after ${CLONE_TIMEOUT_MS / 1000}s` : firstLine(r.output) || 'failed'}` };
  const max = o.maxBytes ?? MAX_GRAVE_BYTES;
  if ((await sizeOf(dest)) > max) return { ok: false, reason: `clone: the grave is too big (over ${Math.ceil(max / 1_048_576)} MB)` };
  const log = await o.run(['git', '-C', dest, 'log', '-1', '--format=%cd', '--date=format:%Y'], { cwd: dest, timeoutMs: 10_000, env, signal: o.signal });
  const diedIn = Number.parseInt(log.output.trim(), 10);
  if (log.code !== 0 || !Number.isInteger(diedIn)) return { ok: false, reason: `clone: no last commit (${firstLine(log.output) || 'git log failed'})` };
  return { ok: true, diedIn, licence: await licenceOf(dest) };
}

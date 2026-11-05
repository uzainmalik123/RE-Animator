// Test helper: a throwaway local git repo, cloned in place of a GitHub grave (R9).
import { execFileSync } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// A local git repo with one commit holding `files`.
export async function localRepo(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'grave-src-'));
  for (const [name, text] of Object.entries(files)) await writeFile(join(dir, name), text);
  const git = (...args: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: dir, stdio: 'ignore' });
  git('init', '-q');
  git('add', '-A');
  git('commit', '-q', '-m', 'the last words');
  return dir;
}

import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CommandResult } from './exec.js';
import { runCommand } from './exec.js';
import { cloneGrave, graveFixture, licenceOf, NO_NPM, parseGraveUrl } from './grave.js';
import { hasBwrap } from './sandbox.js';
import { localRepo } from './test-repo.js';

describe('parseGraveUrl', () => {
  it.each(['https://github.com/a/b', 'https://github.com/a/b.git', 'https://github.com/a/b/'])('accepts %s', (s) => {
    expect(parseGraveUrl(s)).toEqual({ owner: 'a', repo: 'b', url: 'https://github.com/a/b.git' });
  });

  it.each([
    'http://github.com/a/b',
    'https://github.com.evil.com/a/b',
    'https://github.com/a',
    'https://github.com/a/b/tree/main',
    'https://github.com/a/b?x=1',
    'https://github.com/a/b#x',
    'https://github.com/a/..',
    'https://user@github.com/a/b',
    'git@github.com:a/b',
    '',
  ])('rejects %s', (s) => {
    expect(parseGraveUrl(s)).toBeNull();
  });
});

describe('cloneGrave', () => {
  it('clones a repo and reads its headstone: last commit year and licence', async () => {
    const src = await localRepo({ 'package.json': JSON.stringify({ name: 'x', license: 'MIT' }) });
    const dest = join(await mkdtemp(join(tmpdir(), 'grave-')), 'grave');
    const r = await cloneGrave(src, dest, { run: runCommand });
    expect(r).toEqual({ ok: true, diedIn: new Date().getFullYear(), licence: 'MIT' });
  });

  it('calls the licence unknown with no package.json', async () => {
    const src = await localRepo({ 'README.md': 'hi' });
    const dest = join(await mkdtemp(join(tmpdir(), 'grave-')), 'grave');
    expect(await cloneGrave(src, dest, { run: runCommand })).toMatchObject({ ok: true, licence: 'unknown' });
  });

  it('does not read a licence through a symlinked package.json', async () => {
    const src = await localRepo({ 'README.md': 'hi' });
    const dest = join(await mkdtemp(join(tmpdir(), 'grave-')), 'grave');
    const r = await cloneGrave(src, dest, { run: runCommand });
    expect(r.ok).toBe(true);
    const { symlink, writeFile, rm } = await import('node:fs/promises');
    const host = join(await mkdtemp(join(tmpdir(), 'host-')), 'p.json');
    await writeFile(host, JSON.stringify({ license: 'HOST-SECRET' }));
    await rm(join(dest, 'package.json'), { force: true });
    await symlink(host, join(dest, 'package.json'));
    expect(await licenceOf(dest)).toBe('unknown');
  });

  it('fails with a clone: reason when the repo is not there', async () => {
    const dest = join(await mkdtemp(join(tmpdir(), 'grave-')), 'grave');
    const r = await cloneGrave(join(tmpdir(), 'no-such-repo-here'), dest, { run: runCommand });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/^clone: /);
  });

  it('clones shallow, without hooks, submodules or a password prompt', async () => {
    const calls: { argv: string[]; env?: NodeJS.ProcessEnv }[] = [];
    const run = async (argv: string[], o: { env?: NodeJS.ProcessEnv }): Promise<CommandResult> => {
      calls.push({ argv, env: o.env });
      return { code: 1, output: 'fatal: nope', timedOut: false, ms: 1 };
    };
    await cloneGrave('https://github.com/a/b.git', '/tmp/x/grave', { run: run as typeof runCommand });
    expect(calls[0]!.argv).toEqual(['git', '-c', 'core.hooksPath=/dev/null', 'clone', '--depth', '1', '--no-recurse-submodules', '--single-branch', '--', 'https://github.com/a/b.git', '/tmp/x/grave']);
    expect(calls[0]!.env?.GIT_TERMINAL_PROMPT).toBe('0');
  });

  it('refuses a grave over the size cap', async () => {
    const src = await localRepo({ 'big.txt': 'x'.repeat(2048) });
    const dest = join(await mkdtemp(join(tmpdir(), 'grave-')), 'grave');
    const r = await cloneGrave(src, dest, { run: runCommand, maxBytes: 1024 });
    expect(r).toEqual({ ok: false, reason: 'clone: the grave is too big (over 1 MB)' });
  });
});

describe('graveFixture', async () => {
  const available = await hasBwrap();
  it.skipIf(!available)('refuses a grave before any vital when the sandbox has no npm, never calling it dead', async () => {
    const src = await localRepo({ 'package.json': '{}' });
    const workdir = await mkdtemp(join(tmpdir(), 'grave-w-'));
    // A bwrap whose sandbox finds no npm: the real one, with PATH emptied by a wrapper.
    const { writeFile, chmod } = await import('node:fs/promises');
    const fake = join(workdir, 'bwrap-no-npm');
    await writeFile(fake, '#!/bin/sh\ncase "$*" in *" -- npm "*) echo "bwrap: execvp npm: No such file or directory" >&2; exit 1;; esac\nexec bwrap "$@"\n');
    await chmod(fake, 0o755);
    await expect(graveFixture(src, workdir, { run: runCommand, bwrap: fake })).rejects.toThrow(NO_NPM);
  });
});

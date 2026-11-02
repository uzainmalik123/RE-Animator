import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { writeRunDir } from '../../core/test/recording/run-dir.js';
import { main, type MainDeps } from '../src/main.js';

// PRD F15 (D-43): `poltergeist export`.

function capture(extra: Partial<MainDeps> = {}) {
  const out = { stdout: '', stderr: '' };
  const deps: MainDeps = {
    stdout: { write: (s) => void (out.stdout += s), isTTY: false },
    stderr: { write: (s) => void (out.stderr += s) },
    env: { NO_COLOR: '1' },
    ...extra,
  };
  return { out, deps };
}

describe('poltergeist export', () => {
  it('writes a bundle and says it is a recording', async () => {
    const { dir } = await writeRunDir(2);
    const out = join(await mkdtemp(join(tmpdir(), 'cli-rec-')), 'bundle');
    const c = capture();
    expect(await main(['export', dir, '--out', out], c.deps), c.out.stderr).toBe(0);
    expect(existsSync(join(out, 'recording.json'))).toBe(true);
    expect(c.out.stdout).toMatch(/recording: .*bundle \(4 frames, 0 dropped, \d+\.\d MB\)/);
    expect(c.out.stdout).toContain('RECORDED run 20261102-120000-abcd');
  });

  it('resolves relative paths against cwd', async () => {
    const { dir } = await writeRunDir(1);
    const cwd = await mkdtemp(join(tmpdir(), 'cli-rec-'));
    const c = capture({ cwd });
    expect(await main(['export', dir, '--out', 'rel'], c.deps), c.out.stderr).toBe(0);
    expect(existsSync(join(cwd, 'rel', 'recording.json'))).toBe(true);
  });

  it('exits 2 on a non-empty --out', async () => {
    const { dir } = await writeRunDir(1);
    const out = await mkdtemp(join(tmpdir(), 'cli-rec-'));
    await writeFile(join(out, 'x'), '');
    const c = capture();
    expect(await main(['export', dir, '--out', out], c.deps)).toBe(2);
    expect(c.out.stderr).toMatch(/error: .*not empty/);
  });

  it('exits 2 on a folder that is not a run', async () => {
    const empty = await mkdtemp(join(tmpdir(), 'cli-rec-'));
    await mkdir(join(empty, 'nothing'));
    const c = capture();
    expect(await main(['export', join(empty, 'nothing'), '--out', join(empty, 'b')], c.deps)).toBe(2);
    expect(c.out.stderr).toMatch(/error: no events\.ndjson/);
  });
});

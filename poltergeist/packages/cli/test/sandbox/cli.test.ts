import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeClaimsProject, type ClaimsProject } from '../../../core/test/summon/project-fixture.js';
import { main } from '../../src/main.js';

let project: ClaimsProject;
beforeAll(async () => {
  project = await makeClaimsProject();
});
afterAll(async () => project?.close());

describe('poltergeist sandbox (F21)', () => {
  it('serves until interrupted, then exits 0', async () => {
    const out = { stdout: '', stderr: '' };
    const ac = new AbortController();
    const code = main(['sandbox', '--spec', project.specDir, '--config', project.configPath], {
      stdout: { write: (s) => void (out.stdout += s), isTTY: false },
      stderr: { write: (s) => void (out.stderr += s) },
      env: { ...project.env, NO_COLOR: '1' },
      signal: ac.signal,
      sandboxPort: 0,
    });
    for (let i = 0; i < 400 && !/http:\/\/\S+/.test(out.stdout); i++) await new Promise((r) => setTimeout(r, 5));
    const url = /sandbox: (http:\/\/\S+)/.exec(out.stdout)?.[1];
    expect(url, out.stderr).toBeDefined();
    expect(out.stdout).toContain('cached plans only, one run at a time, 6 runs per client per hour');
    expect(await (await fetch(`${url}/health`)).json()).toMatchObject({ ok: true, busy: false });
    ac.abort();
    expect(await code).toBe(0);
  });

  it('warns when listening beyond loopback', async () => {
    const out = { stdout: '', stderr: '' };
    const ac = new AbortController();
    const code = main(['sandbox', '--spec', project.specDir, '--config', project.configPath, '--host', '0.0.0.0'], {
      stdout: { write: (s) => void (out.stdout += s) },
      stderr: { write: (s) => void (out.stderr += s) },
      env: { ...project.env, NO_COLOR: '1' },
      signal: ac.signal,
      sandboxPort: 0,
    });
    for (let i = 0; i < 400 && !out.stdout.includes('sandbox:'); i++) await new Promise((r) => setTimeout(r, 5));
    expect(out.stderr).toContain('warning: sandbox listening on 0.0.0.0: anyone who can reach it can start runs');
    ac.abort();
    expect(await code).toBe(0);
  });

  it('exits 2 when the spec is missing', async () => {
    const out = { stdout: '', stderr: '' };
    const code = await main(['sandbox', '--spec', `${project.root}/nope`, '--config', project.configPath], {
      stdout: { write: (s) => void (out.stdout += s) },
      stderr: { write: (s) => void (out.stderr += s) },
      env: { ...project.env, NO_COLOR: '1' },
      signal: new AbortController().signal,
      sandboxPort: 0,
    });
    expect(code).toBe(2);
    expect(out.stderr).toMatch(/error:/);
  });

  it('exits 2 when the spec has no criteria', async () => {
    const empty = join(project.root, '.kiro', 'specs', 'empty');
    await mkdir(empty, { recursive: true });
    await writeFile(join(empty, 'requirements.md'), '# Requirements Document\n');
    const out = { stdout: '', stderr: '' };
    const code = await main(['sandbox', '--spec', empty, '--config', project.configPath], {
      stdout: { write: (s) => void (out.stdout += s) },
      stderr: { write: (s) => void (out.stderr += s) },
      env: { ...project.env, NO_COLOR: '1' },
      signal: new AbortController().signal,
      sandboxPort: 0,
    });
    expect(code).toBe(2);
    expect(out.stderr).toMatch(/no acceptance criteria/);
  });
});

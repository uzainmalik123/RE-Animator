import { existsSync } from 'node:fs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runCommand } from './exec.js';
import { bwrapSandbox, hasBwrap } from './sandbox.js';
import { STATIC_SERVE } from './serve.js';

describe('bwrapSandbox', () => {
  it('binds only the work dir, unshares all but the network, and runs the command in cwd', () => {
    const argv = bwrapSandbox('/w').argv(['npm', 'install'], '/w/corpse');
    expect(argv[0]).toBe('bwrap');
    const s = argv.join(' ');
    expect(s).toContain('--bind /w /w');
    expect(s).toContain(`--ro-bind ${STATIC_SERVE} ${STATIC_SERVE}`);
    expect(s).toContain('--chdir /w/corpse');
    for (const flag of ['--unshare-all', '--share-net', '--die-with-parent', '--tmpfs /tmp', '--ro-bind /usr /usr']) expect(s).toContain(flag);
    expect(argv.slice(-3)).toEqual(['--', 'npm', 'install']);
  });

  it('gives the body a bare env: system PATH, a home in the work dir, no secrets', () => {
    expect(bwrapSandbox('/w').env({ PORT: '1' })).toEqual({ PATH: '/usr/local/bin:/usr/bin:/bin', HOME: '/w/home', LANG: 'C.UTF-8', PORT: '1' });
  });
});

describe('the real sandbox', async () => {
  const available = await hasBwrap();
  it.skipIf(!available)('writes inside the work dir and cannot read the host outside it', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sandbox-'));
    const secret = join(await mkdtemp(join(tmpdir(), 'host-')), 'secret');
    await writeFile(secret, 'TOPSECRET');
    const sb = bwrapSandbox(root);
    const w = await runCommand(sb.argv(['node', '-e', `require('fs').writeFileSync(${JSON.stringify(join(root, 'ok'))}, '1')`], root), { cwd: root, timeoutMs: 10_000, env: sb.env() });
    expect(w.code).toBe(0);
    expect(existsSync(join(root, 'ok'))).toBe(true);
    const r = await runCommand(sb.argv(['node', '-e', `process.stdout.write(require('fs').readFileSync(${JSON.stringify(secret)}, 'utf8'))`], root), { cwd: root, timeoutMs: 10_000, env: sb.env() });
    expect(r.code).not.toBe(0);
    expect(r.output).not.toContain('TOPSECRET');
    // The host home holds nothing but the path to our static server.
    const h = await runCommand(sb.argv(['node', '-e', `console.log(require('fs').readdirSync(${JSON.stringify(homedir())}).join(','))`], root), { cwd: root, timeoutMs: 10_000, env: sb.env() });
    expect(h.output.trim().split(',').filter((n) => n.startsWith('.'))).toEqual([]);
  });

  it('reports a missing bwrap', async () => {
    expect(await hasBwrap('/no/such/bwrap')).toBe(false);
  });
});

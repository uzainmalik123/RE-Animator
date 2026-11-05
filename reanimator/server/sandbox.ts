// The sandbox for a stranger's repo (R9, D-R23): every install, build and serve of a grave runs in
// bubblewrap. The system is read-only, the ritual's work dir is the only thing it can write, /tmp
// is its own, and it sees no home, no secrets and no other process. The network stays shared:
// install needs the registry, and Death and Chromium reach the app on 127.0.0.1.
import { runCommand } from './exec.js';
import { STATIC_SERVE } from './serve.js';

export interface Sandbox {
  argv(a: string[], cwd: string): string[];
  env(extra?: Record<string, string>): NodeJS.ProcessEnv;
}

const SYSTEM_TRY = ['/bin', '/lib', '/lib64', '/sbin', '/etc/resolv.conf', '/etc/hosts', '/etc/nsswitch.conf', '/etc/ssl', '/etc/ca-certificates', '/etc/pki'];

export function bwrapSandbox(root: string, o: { bwrap?: string } = {}): Sandbox {
  return {
    argv: (a, cwd) => [
      o.bwrap ?? 'bwrap',
      '--ro-bind', '/usr', '/usr',
      ...SYSTEM_TRY.flatMap((p) => ['--ro-bind-try', p, p]),
      '--proc', '/proc',
      '--dev', '/dev',
      '--tmpfs', '/tmp',
      '--bind', root, root,
      '--ro-bind', STATIC_SERVE, STATIC_SERVE,
      '--unshare-all',
      '--share-net',
      '--die-with-parent',
      '--chdir', cwd,
      '--',
      ...a,
    ],
    env: (extra = {}) => ({ PATH: '/usr/local/bin:/usr/bin:/bin', HOME: `${root}/home`, LANG: 'C.UTF-8', ...extra }),
  };
}

// Whether bubblewrap is installed and allowed to make a sandbox here (user namespaces may be off).
export async function hasBwrap(bwrap = 'bwrap'): Promise<boolean> {
  const r = await runCommand([bwrap, '--ro-bind', '/', '/', 'true'], { cwd: '/', timeoutMs: 5000 });
  return r.code === 0;
}

// Running the revived repo's commands for real (R2 vitals). argv arrays only, never a shell string.
// Each child gets its own process group, so a timeout or stop() takes down everything it spawned
// (npm forks node, node may fork more).
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { StringDecoder } from 'node:string_decoder';
import { childEnv } from './env.js';

export const TAIL_BYTES = 4096;
const KILL_GRACE_MS = 2000;

export interface CommandResult {
  code: number | null;
  output: string;
  timedOut: boolean;
  ms: number;
}

// Collects a child's stdout+stderr, keeping only the last TAIL_BYTES characters.
function tail(child: ChildProcess): () => string {
  let buf = '';
  const add = (chunk: Buffer) => {
    buf = (buf + chunk.toString('utf8')).slice(-TAIL_BYTES);
  };
  child.stdout?.on('data', add);
  child.stderr?.on('data', add);
  return () => buf;
}

// SIGTERM the child's whole group, then SIGKILL it if it is still alive after the grace period.
function killGroup(child: ChildProcess, exited: Promise<unknown>): Promise<void> {
  const signal = (sig: NodeJS.Signals) => {
    if (child.pid === undefined || child.exitCode !== null || child.signalCode !== null) return;
    try {
      process.kill(-child.pid, sig);
    } catch {
      /* already gone */
    }
  };
  signal('SIGTERM');
  const hard = setTimeout(() => signal('SIGKILL'), KILL_GRACE_MS);
  return exited.then(() => clearTimeout(hard));
}

function launch(argv: string[], cwd: string, env: NodeJS.ProcessEnv): { child: ChildProcess; exited: Promise<number | null> } {
  const [cmd, ...args] = argv;
  if (!cmd) throw new Error('empty command');
  const child = spawn(cmd, args, { cwd, env, shell: false, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const exited = new Promise<number | null>((resolve) => {
    child.once('error', () => resolve(null));
    child.once('close', (code) => resolve(code));
  });
  return { child, exited };
}

// `signal` aborts the command (a ritual being stopped): its whole group is killed and it reports 'stopped'.
// `onOutput` gets stdout as it arrives (R7 reads Kiro's stream from it), a split character kept whole.
export async function runCommand(
  argv: string[],
  o: { cwd: string; timeoutMs: number; env?: NodeJS.ProcessEnv; signal?: AbortSignal; onOutput?: (text: string) => void },
): Promise<CommandResult> {
  const t0 = Date.now();
  const { child, exited } = launch(argv, o.cwd, o.env ?? childEnv(process.env));
  const output = tail(child);
  const onOutput = o.onOutput;
  if (onOutput) {
    const decoder = new StringDecoder('utf8');
    child.stdout?.on('data', (chunk: Buffer) => onOutput(decoder.write(chunk)));
    child.stdout?.once('end', () => {
      const rest = decoder.end();
      if (rest) onOutput(rest);
    });
  }
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    void killGroup(child, exited);
  }, o.timeoutMs);
  let aborted = false;
  const onAbort = () => {
    aborted = true;
    void killGroup(child, exited);
  };
  if (o.signal?.aborted) onAbort();
  else o.signal?.addEventListener('abort', onAbort, { once: true });
  let spawnError = '';
  child.once('error', (e) => {
    spawnError = e.message;
  });
  const code = await exited;
  clearTimeout(timer);
  o.signal?.removeEventListener('abort', onAbort);
  const note = aborted ? '\nstopped: the ritual was stopped' : spawnError;
  return { code: timedOut || aborted ? null : code, output: (output() + note).slice(-TAIL_BYTES), timedOut, ms: Date.now() - t0 };
}

export interface RunningApp {
  origin: string;
  port: number;
  exited: Promise<number | null>;
  output(): string;
  stop(): Promise<void>;
}

// Start the revived app on 127.0.0.1:<port> (PORT and HOST in its env, D-R7) and leave it running.
export function startApp(argv: string[], o: { cwd: string; port: number }): RunningApp {
  const { child, exited } = launch(argv, o.cwd, childEnv(process.env, { PORT: String(o.port), HOST: '127.0.0.1' }));
  const output = tail(child);
  return {
    origin: `http://127.0.0.1:${o.port}`,
    port: o.port,
    exited,
    output,
    stop: () => killGroup(child, exited),
  };
}

export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

const POLL_MS = 150;

// Poll the URL until it answers 2xx, the app exits, or the timeout passes.
export async function waitForHttp(url: string, o: { timeoutMs: number; exited: Promise<unknown> }): Promise<{ ok: boolean; detail: string }> {
  let exitCode: unknown;
  let hasExited = false;
  void o.exited.then((c) => {
    exitCode = c;
    hasExited = true;
  });
  const deadline = Date.now() + o.timeoutMs;
  let last = 'no answer';
  while (Date.now() < deadline) {
    if (hasExited) return { ok: false, detail: `the app exited (code ${String(exitCode)}) before answering` };
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1000) });
      await res.body?.cancel();
      if (res.ok) return { ok: true, detail: `HTTP ${res.status}` };
      last = `HTTP ${res.status}`;
    } catch {
      /* not listening yet */
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  return { ok: false, detail: `no answer within ${Math.round(o.timeoutMs / 1000)}s (last: ${last})` };
}

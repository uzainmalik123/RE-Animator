import { resolve } from 'node:path';
import { loadConfig, parseSpec, UsageError, type SummonOptions } from '@poltergeist/core';
import type { CliArgs } from '../args.js';
import { paint, termSafe } from '../term/color.js';
import { startSandbox } from './server.js';

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1']);

/** `poltergeist sandbox`: checks the config and spec, serves until `signal` aborts, then exits 0 (F21, D-49). */
export async function runSandbox(
  args: Extract<CliArgs, { command: 'sandbox' }>,
  deps: {
    stdout: { write(s: string): void };
    stderr: { write(s: string): void };
    cwd: string;
    env: NodeJS.ProcessEnv;
    color: boolean;
    signal: AbortSignal;
    port?: number;
    summonOverrides?: Pick<SummonOptions, 'launch' | 'runOptions'>;
  },
): Promise<number> {
  const specDir = resolve(deps.cwd, args.spec);
  // Fail fast on a typo, before anyone can press the button.
  await loadConfig({ path: args.config, cwd: deps.cwd, env: deps.env });
  const { criteria } = await parseSpec(specDir);
  if (criteria.length === 0) throw new UsageError(`no acceptance criteria to haunt in ${specDir}`);
  const sandbox = await startSandbox({
    specDir,
    ...(args.config !== undefined ? { configPath: args.config } : {}),
    cwd: deps.cwd,
    env: deps.env,
    ...(args.reps !== undefined ? { reps: args.reps } : {}),
    runTimeoutMs: args.runTimeoutSec * 1000,
    keep: args.keep,
    host: args.host,
    port: deps.port ?? args.port,
    perClientHour: args.perClientHour,
    trustProxy: args.trustProxy,
    ...(deps.summonOverrides ? { summonOverrides: { launch: deps.summonOverrides.launch, runOptions: deps.summonOverrides.runOptions } } : {}),
    log: (line) => deps.stderr.write(`${termSafe(line, 500)}\n`),
  });
  try {
    if (!LOOPBACK.has(args.host)) deps.stderr.write(`warning: sandbox listening on ${args.host}: anyone who can reach it can start runs\n`);
    const limit = args.perClientHour === 0 ? 'no per-client limit' : `${args.perClientHour} runs per client per hour`;
    deps.stdout.write(`${paint('sandbox:', 'ecto', deps.color)} ${sandbox.url} (cached plans only, one run at a time, ${limit})\n`);
    await new Promise<void>((done) => {
      if (deps.signal.aborted) done();
      else deps.signal.addEventListener('abort', () => done(), { once: true });
    });
    return 0;
  } finally {
    await sandbox.close();
  }
}

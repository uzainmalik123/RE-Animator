// Running the sibling Poltergeist engine (R3, D-R16, KI-R4): its CLI `summon` as a child in its own
// process group (abortable like any vital), never re-implemented here. Progress is the run's own
// redacted events.ndjson, tailed as it grows; results are the report it writes beside the spec.
import { readdir, open } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { EngineEvent } from '../shared/attack.js';
import { runCommand } from './exec.js';

export const DEFAULT_CLI = fileURLToPath(new URL('../../poltergeist/packages/cli/bin/poltergeist.js', import.meta.url));
const ENGINE_TIMEOUT_MS = 15 * 60_000;

type Obj = Record<string, unknown>;
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

// The four event types Reanimator folds, with only the fields it reads; anything else is dropped.
export function toEngineEvent(raw: unknown): EngineEvent | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const e = raw as Obj;
  const s = (k: string) => (typeof e[k] === 'string' ? e[k] : '');
  switch (e.type) {
    case 'run.started':
      return { type: 'run.started', criteria: strs(e.criteria), personas: strs(e.personas), reps: typeof e.reps === 'number' ? e.reps : 0 };
    case 'scout.route':
      return { type: 'scout.route', path: s('path'), status: s('status') };
    case 'plan.compiled':
      return { type: 'plan.compiled', criterion: s('criterion'), persona: s('persona'), status: s('status'), cached: e.cached === true };
    case 'verdict.criterion':
      return { type: 'verdict.criterion', criterion: s('criterion'), verdict: s('verdict') };
    default:
      return null;
  }
}

const listRuns = (runsDir: string) => readdir(runsDir).then((names) => new Set(names), () => new Set<string>());

// Follows the events.ndjson of whichever run dir appears after `before`, parsing whole lines only.
function tailer(runsDir: string, before: Set<string>, onEvent: (e: EngineEvent) => void) {
  let file: string | null = null;
  let runId: string | null = null;
  let offset = 0;
  let partial = '';
  const poll = async () => {
    if (!file) {
      const fresh = [...(await listRuns(runsDir))].find((n) => !before.has(n));
      if (!fresh) return;
      runId = fresh;
      file = join(runsDir, fresh, 'events.ndjson');
    }
    const fh = await open(file, 'r').catch(() => null);
    if (!fh) return;
    try {
      const { size } = await fh.stat();
      if (size <= offset) return;
      const buf = Buffer.alloc(size - offset);
      await fh.read(buf, 0, buf.length, offset);
      offset = size;
      const lines = (partial + buf.toString('utf8')).split('\n');
      partial = lines.pop() ?? '';
      for (const line of lines) {
        if (line.trim() === '') continue;
        let parsed: unknown;
        try {
          parsed = JSON.parse(line);
        } catch {
          continue;
        }
        const e = toEngineEvent(parsed);
        if (e) onEvent(e);
      }
    } finally {
      await fh.close();
    }
  };
  return { poll, runId: () => runId };
}

// The CLI's `error: …` line (exit 2), else its last words.
function errorLine(output: string): string {
  const errs = [...output.matchAll(/^error:\s*(.*)$/gm)];
  if (errs.length > 0) return errs.at(-1)![1]!.trim();
  return output.split('\n').map((l) => l.trim()).filter((l) => l !== '').at(-1) ?? 'engine stopped';
}

export async function runEngine(o: {
  cli: string;
  specDir: string;
  configPath: string;
  home: string;
  env: NodeJS.ProcessEnv;
  only?: string[];
  signal?: AbortSignal;
  timeoutMs?: number;
  onEvent: (e: EngineEvent) => void;
  pollMs?: number;
}): Promise<{ code: number | null; error: string | null; runId: string | null; reportPath: string }> {
  const runsDir = join(o.home, '.poltergeist', 'runs');
  const { poll, runId: foundRun } = tailer(runsDir, await listRuns(runsDir), o.onEvent);
  let polling = Promise.resolve();
  const timer = setInterval(() => {
    polling = polling.then(poll).catch(() => undefined);
  }, o.pollMs ?? 250);
  const argv = [process.execPath, o.cli, 'summon', '--spec', o.specDir, '--config', o.configPath];
  if (o.only && o.only.length > 0) argv.push('--only', o.only.join(','));
  let r;
  try {
    r = await runCommand(argv, { cwd: o.home, env: o.env, timeoutMs: o.timeoutMs ?? ENGINE_TIMEOUT_MS, signal: o.signal });
  } finally {
    clearInterval(timer);
  }
  await polling;
  await poll().catch(() => undefined); // whatever landed between the last tick and the exit
  const runId = foundRun();
  // Node also exits 1 on a crash (an uncaught error, a missing dependency): with no run dir it never ran.
  const ok = (r.code === 0 || r.code === 1) && runId !== null;
  const error = ok ? null : r.timedOut ? `the engine timed out after ${Math.round((o.timeoutMs ?? ENGINE_TIMEOUT_MS) / 60_000)} min` : errorLine(r.output);
  return { code: r.code, error, runId, reportPath: join(o.specDir, 'haunting-report.json') };
}

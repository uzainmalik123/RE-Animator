import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CACHE_ONLY_MESSAGE, type SummonEvent, type SummonOptions, type SummonResult } from '@poltergeist/core';

export type FakeBehaviour = 'finish' | 'hang' | 'usage' | 'usage-path' | 'crash';

/** A summon that emits `run.started` into a real temp run folder, then finishes, hangs until aborted, or throws. */
export function fakeSummon(behaviour: () => FakeBehaviour = () => 'finish') {
  const calls: SummonOptions[] = [];
  const dirs: string[] = [];
  let root: string | undefined;
  const fn = async (opts: SummonOptions): Promise<SummonResult> => {
    calls.push(opts);
    const mode = behaviour();
    const { UsageError } = await import('@poltergeist/core');
    if (mode === 'usage') throw new UsageError('unknown criterion id: 9.9 (known: 3.1, 3.2)');
    if (mode === 'usage-path') throw new UsageError('no acceptance criteria to haunt in /spec/requirements.md');
    root ??= await mkdtemp(join(tmpdir(), 'sandbox-runs-'));
    const runId = opts.runId!;
    const runDir = join(root, '.poltergeist', 'runs', runId);
    await mkdir(runDir, { recursive: true });
    dirs.push(runDir);
    const emit = (e: SummonEvent) => opts.onEvent?.(e);
    emit({ type: 'run.started', t: Date.now(), runId, runDir, specDir: join(root, '.kiro', 'specs', 'claims'), target: 'http://127.0.0.1:1', criteria: ['3.1', '3.2'], personas: ['wraith'], reps: 1 });
    if (mode === 'crash') throw new Error('EACCES: /home/secret/path');
    if (mode === 'hang') {
      await new Promise((_, reject) => {
        const signal = opts.signal!;
        if (signal.aborted) reject(signal.reason);
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    }
    emit({ type: 'run.finished', t: Date.now(), runId, counts: { clean: 1, haunted: 1, inconclusive: 1, notApplicable: 0 } as never, haunted: ['3.2'], durationMs: 5 });
    return {
      runId, runDir, specDir: '', target: '', criteria: [], haunted: ['3.2'], allResetsFailed: false,
      compiled: [
        { status: 'uncompilable', criterion: '3.1', persona: 'wraith', reason: `llm error: ${CACHE_ONLY_MESSAGE}`, errors: [], attempts: 1 },
        { status: 'uncompilable', criterion: '3.2', persona: 'banshee', reason: 'no matching route', errors: [], attempts: 0 },
      ],
      verdicts: { counts: { clean: 1, haunted: 1, inconclusive: 1, notApplicable: 0 } } as never,
      merged: [{ id: '3.1', verdict: 'clean' }, { id: '3.2', verdict: 'haunted' }],
      reportPaths: { markdownPath: '', jsonPath: '' },
      changes: [{ id: '3.2', from: 'clean', to: 'haunted' }],
    } as unknown as SummonResult;
  };
  return { fn, calls, dirs };
}

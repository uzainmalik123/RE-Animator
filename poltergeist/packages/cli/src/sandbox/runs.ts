import { rm } from 'node:fs/promises';
import {
  CACHE_ONLY_MESSAGE,
  cacheOnlyLlm,
  newRunId,
  publicEvent,
  summon as coreSummon,
  UsageError,
  type SummonEvent,
  type SummonOptions,
  type SummonResult,
} from '@poltergeist/core';
import { createLiveBroadcast, type LiveBroadcast } from '../live-broadcast.js';

export type SummonFn = (opts: SummonOptions) => Promise<SummonResult>;

export type SandboxStatus = 'running' | 'finished' | 'failed' | 'aborted';

export type SandboxSummary = {
  runId: string;
  status: SandboxStatus;
  startedAt: number;
  finishedAt?: number;
  criteria?: { id: string; verdict: string }[];
  haunted?: string[];
  counts?: Record<string, number>;
  changes?: { id: string; from: string; to: string }[];
  /** Pairs that had no cached plan, so they couldn't run (uncompilable). */
  cacheMisses?: number;
  durationMs?: number;
  error?: string;
};

export type SandboxRunsOptions = {
  specDir: string;
  configPath?: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
  reps?: number;
  runTimeoutMs: number;
  /** Runs kept (summary, live backlog, run folder), 1–50. */
  keep: number;
  /** Tests only. */
  summon?: SummonFn;
  summonOverrides?: Pick<SummonOptions, 'launch' | 'runOptions'>;
  /** The operator's log: the real errors and warnings, never sent to visitors. */
  log?: (message: string) => void;
};

export class SandboxBusyError extends Error {
  override name = 'SandboxBusyError';
  constructor(readonly activeRunId: string) {
    super(`run ${activeRunId} is still going`);
  }
}

export class SandboxClosedError extends Error {
  override name = 'SandboxClosedError';
  constructor() {
    super('the sandbox is shutting down');
  }
}

type Run = { id: string; summary: SandboxSummary; broadcast: LiveBroadcast; ac: AbortController; runDir?: string; done: Promise<void> };

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

/**
 * The sandbox's runs (PRD F21, D-49): one at a time, cached plans only, aborted after `runTimeoutMs`.
 * Visitors get public events and summaries; the operator's log gets the real errors.
 * Only the newest `keep` runs are kept, and an evicted run's folder (one this manager started) is deleted.
 */
export class SandboxRuns {
  /** Oldest first. */
  private readonly runs = new Map<string, Run>();
  private active: Run | undefined;
  private readonly summon: SummonFn;
  private readonly log: (message: string) => void;
  private closing = false;

  constructor(private readonly opts: SandboxRunsOptions) {
    this.summon = opts.summon ?? coreSummon;
    this.log = opts.log ?? (() => undefined);
  }

  /**
   * Resolves with the run id once the run has started; rejects with `SandboxBusyError`, `SandboxClosedError`,
   * `UsageError` or a generic error. Older runs are evicted only once this one has really started.
   */
  async start(req: { only?: string[]; personas?: string[] }): Promise<string> {
    if (this.closing) throw new SandboxClosedError();
    if (this.active) throw new SandboxBusyError(this.active.id);
    let id = newRunId();
    while (this.runs.has(id)) id = newRunId();
    const ac = new AbortController();
    let settle!: () => void;
    const run: Run = {
      id, ac, broadcast: createLiveBroadcast(id), summary: { runId: id, status: 'running', startedAt: Date.now() },
      done: new Promise<void>((r) => (settle = r)),
    };
    this.active = run; // claimed before any await, so a concurrent start (or close) sees it

    let started!: () => void;
    const startedP = new Promise<void>((r) => (started = r));
    const timer = setTimeout(() => ac.abort(new DOMException('run timed out', 'TimeoutError')), this.opts.runTimeoutMs);
    const onEvent = (e: SummonEvent) => {
      if (e.type === 'run.started') {
        run.runDir = e.runDir;
        started();
      }
      run.broadcast.publish(publicEvent(e));
    };
    const summoned = Promise.resolve().then(() => {
      // close() may have begun since start(): never launch a browser nobody will stop.
      ac.signal.throwIfAborted();
      return this.summon({
        specDir: this.opts.specDir,
        configPath: this.opts.configPath,
        cwd: this.opts.cwd,
        env: this.opts.env,
        only: req.only,
        personas: req.personas,
        reps: this.opts.reps,
        recompile: false,
        runId: id,
        llm: cacheOnlyLlm(),
        signal: ac.signal,
        onEvent,
        onWarning: (w) => this.log(`warning: ${w}`),
        ...this.opts.summonOverrides,
      });
    });
    void summoned
      .then(
        (result) => this.finish(run, result),
        (err: unknown) => this.fail(run, err),
      )
      .finally(() => {
        clearTimeout(timer);
        if (this.active === run) this.active = undefined;
        run.broadcast.end(1000, run.summary.status);
        settle();
      });

    const first = await Promise.race([startedP.then(() => 'started' as const), run.done.then(() => 'settled' as const)]);
    if (first === 'started' || run.runDir !== undefined) {
      this.runs.set(id, run);
      await this.evict(this.opts.keep);
      return id;
    }
    // Nothing started (a bad criterion id, a broken config, closing): nothing to keep.
    const err = await summoned.then(() => new Error('run failed'), (e: unknown) => e);
    if (err instanceof UsageError) throw err;
    if (this.closing) throw new SandboxClosedError();
    throw new Error('run failed');
  }

  get(runId: string): { summary: SandboxSummary; broadcast: LiveBroadcast } | undefined {
    return this.runs.get(runId);
  }

  /** Newest first. */
  list(): SandboxSummary[] {
    return [...this.runs.values()].reverse().map((r) => r.summary);
  }

  activeId(): string | undefined {
    return this.active?.id;
  }

  /** Refuses new runs from now on, aborts the active one and waits for it to settle. */
  async close(): Promise<void> {
    this.closing = true;
    const active = this.active;
    active?.ac.abort(new DOMException('sandbox closing', 'AbortError'));
    await active?.done;
    for (const run of this.runs.values()) run.broadcast.closeAll(1001, 'sandbox closing');
  }

  private finish(run: Run, result: SummonResult) {
    const finishedAt = Date.now();
    const cacheMisses = result.compiled.filter((p) => p.status === 'uncompilable' && p.reason.includes(CACHE_ONLY_MESSAGE)).length;
    if (cacheMisses > 0) this.log(`warning: ${cacheMisses} cache miss${cacheMisses === 1 ? '' : 'es'} in run ${run.id}; warm the cache with poltergeist summon`);
    run.summary = {
      ...run.summary,
      status: 'finished',
      finishedAt,
      criteria: result.merged.map(({ id, verdict }) => ({ id, verdict })),
      haunted: result.haunted,
      counts: { ...result.verdicts.counts },
      changes: result.changes.map(({ id, from, to }) => ({ id, from, to })),
      cacheMisses,
      durationMs: finishedAt - run.summary.startedAt,
    };
  }

  private fail(run: Run, err: unknown) {
    const finishedAt = Date.now();
    const aborted = run.ac.signal.aborted;
    this.log(`run ${run.id} ${aborted ? 'aborted' : 'failed'}: ${message(aborted ? run.ac.signal.reason : err)}`);
    run.summary = {
      ...run.summary,
      status: aborted ? 'aborted' : 'failed',
      finishedAt,
      durationMs: finishedAt - run.summary.startedAt,
      ...(aborted ? {} : { error: 'run failed' }),
    };
  }

  /** Drops the oldest settled runs until at most `max` remain (the active run is never dropped). */
  private async evict(max: number) {
    for (const run of this.runs.values()) {
      if (this.runs.size <= max) break;
      if (run === this.active) continue;
      this.runs.delete(run.id);
      run.broadcast.closeAll(1001, 'evicted');
      if (run.runDir !== undefined) await rm(run.runDir, { recursive: true, force: true }).catch((err: unknown) => this.log(`warning: could not delete ${run.runDir}: ${message(err)}`));
    }
  }
}

import type { Browser } from 'playwright-core';
import type { PairResult } from '../compiler/compile.js';
import type { LlmClient } from '../compiler/llm.js';
import type { PersonaId } from '../personas/registry.js';
import type { RunEvent, RunOptions } from '../runner/types.js';
import type { RouteStatus } from '../scout/types.js';
import type { ReportVerdict, VerdictChange } from '../report/merge.js';
import type { Criterion } from '../spec/types.js';
import type { Verdicts } from '../verdicts/compute.js';
import type { CriterionVerdict, PairVerdict } from '../verdicts/types.js';

/** The runner's events plus the orchestrator's own (design §8, D-36). */
export type SummonEvent =
  | RunEvent
  | ({ t: number } & (
      | { type: 'run.started'; runId: string; runDir: string; specDir: string; target: string; criteria: string[]; personas: PersonaId[]; reps: number }
      | { type: 'scout.route'; path: string; identity: string; status: RouteStatus }
      | { type: 'plan.compiled'; criterion: string; persona: PersonaId; status: PairResult['status']; cached: boolean }
      | { type: 'verdict.pair'; criterion: string; persona: PersonaId; verdict: PairVerdict; reason: string }
      | { type: 'verdict.criterion'; criterion: string; verdict: CriterionVerdict }
      | { type: 'run.finished'; runId: string; counts: Record<PairVerdict, number>; haunted: string[]; durationMs: number }
    ));

export type SummonOptions = {
  specDir: string;
  /** Defaults to `<cwd>/poltergeist.config.json`. */
  configPath?: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  /** Criterion ids to run; default all. */
  only?: readonly string[];
  /** Persona ids; default every built-in persona. Duplicates are dropped. */
  personas?: readonly string[];
  /** 1…10, default `config.reps`. */
  reps?: number;
  /** Skip cache reads. */
  recompile?: boolean;
  /** Default `newRunId()`. */
  runId?: string;
  /** Default `createAnthropicClient()`. */
  llm?: LlmClient;
  /** Default `chromium.launch(summonLaunchOptions())`: guarded, with Playwright's SIGINT handler off. */
  launch?: () => Promise<Browser>;
  signal?: AbortSignal;
  onEvent?: (e: SummonEvent) => void;
  onWarning?: (message: string) => void;
  /** Tests only. */
  runOptions?: Pick<RunOptions, 'frameFps' | 'stepTimeoutMs' | 'planTimeoutMs'>;
};

export type SummonResult = {
  runId: string;
  runDir: string;
  specDir: string;
  target: string;
  /** The selected criteria, in spec order. */
  criteria: Criterion[];
  compiled: PairResult[];
  verdicts: Verdicts;
  /**
   * The selected criteria's verdicts as the report states them: this run's pairs merged with
   * personas carried from the previous report (D-42). `verdicts` holds only this run's.
   */
  merged: { id: string; verdict: ReportVerdict }[];
  /** Selected criterion ids whose merged verdict is `haunted`. */
  haunted: string[];
  /** Every rep's reset failed, so nothing ran (exit code 2, D-36). */
  allResetsFailed: boolean;
  resetError?: string;
  reportPaths: { markdownPath: string; jsonPath: string };
  /** Re-run criteria whose verdict changed since the spec's previous report (F14, D-42). */
  changes: VerdictChange[];
  /** The previous report's run id, when there was one to merge and diff against. */
  previousRunId?: string;
};

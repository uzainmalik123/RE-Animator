// Death's attack protocol (R3, D-R17): what the backend streams while the Poltergeist engine attacks
// the revived app, and the one reducer both sides fold it with. A wound is a haunted pair from a
// real report (D-R11); progress is the engine's own events, never a timer.

// A finding that reproduced: one criterion broken by one of Death's minions (a persona).
export interface Wound {
  criterion: string;
  text: string;
  persona: string;
  reason: string;
  steps: string[];
  expected: string[];
  failing: string[];
  artifacts: string[];
}

export type Counts = Record<'haunted' | 'flaky' | 'inconclusive' | 'clean' | 'notApplicable' | 'notRun', number>;

// The subset of the engine's events.ndjson that Reanimator reads (Poltergeist design §8).
export type EngineEvent =
  | { type: 'run.started'; criteria: string[]; personas: string[]; reps: number }
  | { type: 'scout.route'; path: string; status: string }
  | { type: 'plan.compiled'; criterion: string; persona: string; status: string; cached: boolean }
  | { type: 'verdict.criterion'; criterion: string; verdict: string };

export type AttackEvent =
  | { type: 'summoned'; origin: string; only: string[] | null }
  | { type: 'engine'; event: EngineEvent }
  | { type: 'finished'; counts: Counts; wounds: Wound[] }
  | { type: 'failed'; reason: string };

export interface AttackState {
  status: 'idle' | 'attacking' | 'finished' | 'failed';
  origin: string | null;
  routes: number;
  plans: number;
  planned: number;
  verdicts: Record<string, string>;
  counts: Counts | null;
  wounds: Wound[];
  failure: string | null;
}

export const QUIET: AttackState = {
  status: 'idle',
  origin: null,
  routes: 0,
  plans: 0,
  planned: 0,
  verdicts: {},
  counts: null,
  wounds: [],
  failure: null,
};

export const attackOver = (e: AttackEvent): boolean => e.type === 'finished' || e.type === 'failed';

function reduceEngine(s: AttackState, e: EngineEvent): AttackState {
  switch (e.type) {
    case 'run.started':
      return { ...s, planned: e.criteria.length * e.personas.length };
    case 'scout.route':
      return { ...s, routes: s.routes + 1 };
    case 'plan.compiled':
      return { ...s, plans: s.plans + 1 };
    case 'verdict.criterion':
      return { ...s, verdicts: { ...s.verdicts, [e.criterion]: e.verdict } };
  }
}

export function reduceAttack(s: AttackState, e: AttackEvent): AttackState {
  switch (e.type) {
    case 'summoned':
      return { ...QUIET, status: 'attacking', origin: e.origin };
    case 'engine':
      return reduceEngine(s, e.event);
    case 'finished':
      return { ...s, status: 'finished', counts: e.counts, wounds: e.wounds };
    case 'failed':
      return { ...s, status: 'failed', failure: e.reason };
  }
}

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
  | { type: 'verdict.criterion'; criterion: string; verdict: string }
  // R4: where Death's minions are (a step's x,y is in that ghost's viewport px) and the frames of the
  // app they see (a mark from frames.ndjson, at most one a second per ghost; the jpg is served apart).
  | { type: 'ghost.spawned'; ghostId: string; criterion: string; persona: string; rep: number }
  | { type: 'ghost.step'; ghostId: string; x?: number; y?: number }
  | { type: 'rep.finished'; rep: number }
  | { type: 'frame'; ghostId: string; seq: number };

type Point = { x: number; y: number };

// One minion (a Poltergeist ghost), as R4 draws it. `trail` is its last 3 earlier positions, oldest first.
export interface Ghost {
  ghostId: string;
  criterion: string;
  persona: string;
  rep: number;
  x?: number;
  y?: number;
  trail: Point[];
  done: boolean;
  frame?: number;
}

const TRAIL = 3;

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
  ghosts: Record<string, Ghost>;
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
  ghosts: {},
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
    case 'ghost.spawned':
      return { ...s, ghosts: { ...s.ghosts, [e.ghostId]: { ghostId: e.ghostId, criterion: e.criterion, persona: e.persona, rep: e.rep, trail: [], done: false } } };
    case 'ghost.step': {
      const g = s.ghosts[e.ghostId];
      if (!g) return s;
      if (e.x === undefined || e.y === undefined) return s;
      const trail = g.x === undefined || g.y === undefined ? g.trail : [...g.trail, { x: g.x, y: g.y }].slice(-TRAIL);
      return { ...s, ghosts: { ...s.ghosts, [e.ghostId]: { ...g, x: e.x, y: e.y, trail } } };
    }
    case 'frame': {
      const g = s.ghosts[e.ghostId];
      if (!g) return s;
      return { ...s, ghosts: { ...s.ghosts, [e.ghostId]: { ...g, frame: e.seq } } };
    }
    case 'rep.finished':
      return { ...s, ghosts: Object.fromEntries(Object.entries(s.ghosts).map(([id, g]) => [id, g.rep === e.rep ? { ...g, done: true } : g])) };
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

// The ritual protocol (R2, D-R15): the events the backend streams while it raises a repo, and the
// one pure reducer both the server and the UI fold them with. Nothing here is animated or timed;
// every beat is a real vital result (D-R11).

export const VITALS = ['install', 'build', 'serve', 'render'] as const;
export type VitalName = (typeof VITALS)[number];

// 'corpse' = the untouched dead repo (its failure is the real flatline); 'revived' = after the remedy.
export type Phase = 'corpse' | 'revived';

export interface VitalResult {
  vital: VitalName;
  ok: boolean;
  detail: string;
  ms: number;
}

export type RitualEvent =
  | { type: 'started'; repo: string; diedIn: number }
  | { type: 'vital'; phase: Phase; result: VitalResult }
  | { type: 'remedy'; files: number }
  | { type: 'risen'; origin: string }
  | { type: 'failed'; phase: Phase; reason: string };

export type RitualStatus = 'idle' | 'examining' | 'raising' | 'risen' | 'failed';

export interface RitualState {
  status: RitualStatus;
  repo: string | null;
  diedIn: number | null;
  corpse: VitalResult[];
  revived: VitalResult[];
  origin: string | null;
  failure: string | null;
}

export const IDLE: RitualState = {
  status: 'idle',
  repo: null,
  diedIn: null,
  corpse: [],
  revived: [],
  origin: null,
  failure: null,
};

export function reduceRitual(s: RitualState, e: RitualEvent): RitualState {
  switch (e.type) {
    case 'started':
      return { ...IDLE, status: 'examining', repo: e.repo, diedIn: e.diedIn };
    case 'vital':
      return e.phase === 'corpse' ? { ...s, corpse: [...s.corpse, e.result] } : { ...s, revived: [...s.revived, e.result] };
    case 'remedy':
      return { ...s, status: 'raising' };
    case 'risen':
      return { ...s, status: 'risen', origin: e.origin };
    case 'failed':
      return { ...s, status: 'failed', failure: e.reason };
  }
}

// How many revived vitals have really passed (0..4): the heart monitor's beats.
export function beats(s: RitualState): number {
  return s.revived.filter((r) => r.ok).length;
}

// True once the untouched corpse has really failed a vital: the flatline is proven, not drawn.
export function flatlined(s: RitualState): boolean {
  return s.corpse.some((r) => !r.ok);
}

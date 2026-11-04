// Poltergeist's haunting-report.json (its D-35, version 1) → Reanimator's wounds. Only a haunted pair
// is a wound: it reproduced (Poltergeist D-06). Flaky and inconclusive pairs only reach the counts.
// Validated by hand for the fields we read; the engine itself validates the whole file with zod.
import { readFile } from 'node:fs/promises';
import type { Counts, Wound } from '../shared/attack.js';

const UNREADABLE = 'the engine wrote no readable report';
const COUNT_KEYS = ['haunted', 'flaky', 'inconclusive', 'clean', 'notApplicable', 'notRun'] as const;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

function failingLine(f: unknown): string | null {
  if (!isObj(f)) return null;
  return `${str(f.expected)} (${typeof f.failures === 'number' ? f.failures : 0}×): ${str(f.lastDetail)}`;
}

function wound(criterion: Obj, pair: Obj): Wound {
  const steps = isObj(pair.steps) ? pair.steps : {};
  return {
    criterion: str(criterion.id),
    text: str(criterion.text),
    persona: str(pair.persona),
    reason: str(pair.reason),
    steps: [...strings(steps.a), ...strings(steps.b).map((s) => `B: ${s}`)],
    expected: strings(pair.expected),
    failing: (Array.isArray(pair.failing) ? pair.failing : []).map(failingLine).filter((l): l is string => l !== null),
    artifacts: strings(pair.artifacts),
  };
}

// `runId`, when given, must be the report's own: a stale report from an earlier run is never read as new.
export async function readWounds(jsonPath: string, runId?: string): Promise<{ counts: Counts; wounds: Wound[] }> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(jsonPath, 'utf8'));
  } catch {
    throw new Error(UNREADABLE);
  }
  if (!isObj(raw) || raw.version !== 1 || !Array.isArray(raw.criteria)) throw new Error(UNREADABLE);
  if (runId !== undefined && raw.runId !== runId) throw new Error(UNREADABLE);
  const c = isObj(raw.counts) ? raw.counts : {};
  const counts = Object.fromEntries(COUNT_KEYS.map((k) => [k, typeof c[k] === 'number' ? c[k] : 0])) as Counts;
  const wounds: Wound[] = [];
  for (const criterion of raw.criteria) {
    if (!isObj(criterion) || !Array.isArray(criterion.pairs)) continue;
    for (const pair of criterion.pairs) if (isObj(pair) && pair.verdict === 'haunted') wounds.push(wound(criterion, pair));
  }
  return { counts, wounds };
}

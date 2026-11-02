import type { PairResult } from '../../src/compiler/compile.js';
import type { HauntingPlan } from '../../src/compiler/dsl.js';
import type { PersonaId } from '../../src/personas/registry.js';
import type { ReportInput } from '../../src/report/render.js';
import type { AssertionResult, PairRepResult } from '../../src/runner/types.js';
import { computeVerdicts } from '../../src/verdicts/compute.js';
import { criterion } from '../compiler/criteria.js';

export const verdictsFor = (pairs: readonly PairResult[], results: readonly PairRepResult[], reps: number) => computeVerdicts(pairs, { reps, results: [...results] });

export const SPEC_DIR = '/p/.kiro/specs/s';
export const RUN = { runId: 'r1', runDir: '/p/.poltergeist/runs/r1', target: 'http://127.0.0.1:4000', reps: 3, model: 'claude-sonnet-5-5', startedAt: Date.UTC(2026, 10, 1, 12) };

export const at = (id: string, text: string, line: number, requirement = 'Claims') => ({ ...criterion(id, text), line, requirement });

export const RACE: HauntingPlan = {
  criterion: '3.2', persona: 'doppelganger', intent: 'Two sessions claim the same candy at once; only one should succeed.',
  routes: [{ path: '/claims', identity: 'default' }],
  actors: {
    a: [{ goto: '/claims' }, { barrier: 'fire' }, { click: { role: 'button', name: 'Claim Sour Skulls' } }],
    b: [{ goto: '/claims' }, { barrier: 'fire' }, { click: { role: 'button', name: 'Claim Sour Skulls' } }],
  },
  assert: [{ api: { method: 'GET', path: '/api/candies/sour-skulls', jsonPath: '$.claims.length', equals: 1 } }],
};
export const simple = (criterion: string, persona: PersonaId, over: Partial<HauntingPlan> = {}): HauntingPlan => ({
  criterion, persona, intent: 'i', routes: [{ path: '/form', identity: 'anonymous' }],
  actors: { a: [{ goto: '/form' }, { fill: { target: { label: 'Name' }, input: { generator: 'naughty' } } }] },
  assert: [{ textVisible: 'Saved' }], ...over,
});
export const compiled = (plan: HauntingPlan): PairResult => ({ status: 'compiled', criterion: plan.criterion, persona: plan.persona, plan, cached: false, attempts: 1 });

export type A = [ok: boolean, failure?: AssertionResult['failure'], detail?: string];
export function reps(c: string, persona: PersonaId, per: { outcome?: PairRepResult['outcome']; asserts: A[]; artifacts?: string[] }[]): PairRepResult[] {
  return per.map((r, i) => ({
    criterion: c, persona, rep: i + 1, outcome: r.outcome ?? 'completed', steps: [], blocked: [], notes: [], artifacts: r.artifacts ?? [],
    assertions: r.asserts.map(([ok, failure, detail], index) => ({ index, type: 'x', ok, detail: detail ?? (ok ? 'ok' : `claims.length was 2`), ...(failure ? { failure } : {}) })),
    startedAt: 0, endedAt: 1, ...(r.outcome && r.outcome !== 'completed' ? { error: 'target not found: button "Go"' } : {}),
  }));
}
/** Lines in the file, as `wc -l` counts them. */
export const lines = (md: string) => md.split('\n').length - 1;
export const F: A = [false, 'app'];
export const T: A = [true];

export function input(over: Partial<ReportInput> = {}): ReportInput {
  const criteria = [
    at('2.1', 'THE Form SHALL save any name.', 30, 'Forms'),
    at('3.2', 'WHEN two sessions claim the same candy at once, THE System SHALL record only one claim.', 41),
    at('4.1', 'THE System SHALL show a receipt.', 50),
    at('5.1', 'THE System SHALL be pleasant.', 60),
    at('6.1', 'THE System SHALL export CSV.', 70),
  ];
  const pairs = [
    compiled(simple('2.1', 'banshee')),
    compiled(RACE),
    compiled(simple('4.1', 'wraith')),
    { status: 'notApplicable', criterion: '5.1', persona: 'wraith', reason: 'not testable in a browser', routes: [], cached: false, attempts: 1 } as PairResult,
  ];
  const results = [
    ...reps('2.1', 'banshee', [{ asserts: [F] }, { asserts: [T] }, { asserts: [T] }]),
    ...reps('3.2', 'doppelganger', [1, 2, 3].map((n) => ({ asserts: [F], artifacts: [`artifacts/3.2__doppelganger__rep${n}/screenshot-a.png`] }))),
    ...reps('4.1', 'wraith', [1, 2, 3].map(() => ({ outcome: 'planError' as const, asserts: [] }))),
  ];
  return { specDir: SPEC_DIR, criteria, compiled: pairs, verdicts: verdictsFor(pairs, results, 3), run: RUN, ...over };
}

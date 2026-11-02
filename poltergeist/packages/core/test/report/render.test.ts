import { describe, expect, it } from 'vitest';
import type { HauntingPlan } from '../../src/compiler/dsl.js';
import { REPORT_MAX_LINES, renderReport } from '../../src/report/render.js';
import { ReportJsonSchema } from '../../src/report/schema.js';
import { at, compiled, F, input, lines, RACE, reps, RUN, simple, T, verdictsFor } from './builders.js';

describe('renderReport: markdown', () => {
  const { markdown } = renderReport(input());

  it('opens with a heading and the wordmark in a text block', () => {
    expect(markdown.startsWith('# Haunting report\n\n```text\n')).toBe(true);
    expect(markdown).toContain('your spec, haunted.');
  });

  it('has the run line and the counts', () => {
    expect(markdown).toContain('Run `r1` against `http://127.0.0.1:4000` · 3 reps · claude-sonnet-5-5 · 2026-11-01T12:00:00.000Z');
    expect(markdown).toContain('**1 haunted** [!!] · 1 flaky [~~] · 1 inconclusive [??] · 0 clean [ok] · 1 n/a [--] · 1 not run [  ]');
  });

  it('lists every criterion on the board in spec order', () => {
    const board = markdown.split('## Board\n\n')[1]!.split('\n\n')[0]!.split('\n');
    expect(board).toEqual([
      '- [~~] 2.1 — THE Form SHALL save any name.',
      '- [!!] 3.2 — WHEN two sessions claim the same candy at once, THE System SHALL record only one claim.',
      '- [??] 4.1 — THE System SHALL show a receipt.',
      '- [--] 5.1 — THE System SHALL be pleasant.',
      '- [  ] 6.1 — THE System SHALL export CSV.',
    ]);
  });

  it('writes a fix-ready task for the haunted criterion', () => {
    const s = markdown.split('## Haunted\n')[1]!.split('\n## ')[0]!;
    expect(s).toContain('### [!!] 3.2 — WHEN two sessions');
    expect(s).toContain('**Promise:** `requirements.md` line 41, Requirement 3 (Claims): `WHEN two sessions claim');
    expect(s).toContain('#### doppelganger — failed 3/3 reps');
    expect(s).toContain('**Intent:** Two sessions claim the same candy at once; only one should succeed.');
    expect(s).toContain('Actor a:\n\n1. go to /claims\n2. wait at barrier "fire" until every actor reaches it\n3. click button "Claim Sour Skulls"');
    expect(s).toContain('Actor b:\n\n1. go to /claims');
    expect(s).toContain('**Expected:** GET /api/candies/sour-skulls $.claims.length equals 1');
    expect(s).toContain('**Failed in reps:** 1, 2, 3');
    expect(s).toContain('**Actual** (failed 3/3 reps, last seen): `claims.length was 2`');
    expect(s).toContain('**Artifacts** (paths relative to this report\'s folder):');
    expect(s).toContain('- `../../../.poltergeist/runs/r1/artifacts/3.2__doppelganger__rep1/screenshot-a.png`');
    expect(s).toContain('**Fix:** ');
  });

  it('summarises flaky and inconclusive pairs', () => {
    expect(markdown).toContain('### [~~] 2.1 — THE Form SHALL save any name.');
    expect(markdown).toContain('- banshee failed 1/3 reps: text "Saved" is visible — `claims.length was 2`');
    expect(markdown).toContain('- [??] 4.1 wraith: `only 0 of 3 reps completed cleanly (needs 2); 3 planError; rep 1: target not found: button "Go"`');
  });

  it('never prints a fill value, only the generator', () => {
    const md = renderReport(input({ verdicts: verdictsFor(input().compiled, reps('2.1', 'banshee', [{ asserts: [F] }, { asserts: [F] }, { asserts: [F] }]), 3) })).markdown;
    expect(md).toContain('2. fill field labelled "Name" with generator: naughty');
  });
});

describe('renderReport: edge cases', () => {
  it('keeps hostile criterion text on one line with a valid code span (Review Focus 2)', () => {
    const base = input();
    const criteria = base.criteria.map((c) => (c.id === '3.2' ? { ...c, text: 'Use `code` | here\nnext' } : c));
    const md = renderReport({ ...base, criteria }).markdown;
    expect(md).toContain('- [!!] 3.2 — Use \\`code\\` \\| here next');
    expect(md).toContain('(Claims): ``Use `code` | here next``');
  });

  it('escapes markdown in board lines, headings and the intent (KI-41)', () => {
    const base = input();
    const criteria = base.criteria.map((c) => (c.id === '3.2' ? { ...c, text: 'Hidden <!-- rest' } : c));
    const race = { ...RACE, intent: '**bold** [x](y)' };
    const pairs = base.compiled.map((p) => (p.status === 'compiled' && p.criterion === '3.2' ? { ...p, plan: race } : p));
    const md = renderReport({ ...base, criteria, compiled: pairs }).markdown;
    expect(md).toContain('- [!!] 3.2 — Hidden \\<!-- rest');
    expect(md).toContain('### [!!] 3.2 — Hidden \\<!-- rest');
    expect(md).toContain('**Intent:** \\*\\*bold\\*\\* \\[x\\](y)');
    expect(md.split('\n').filter((l) => l.includes('Hidden <!--')).every((l) => l.includes('`Hidden <!-- rest`'))).toBe(true);
  });

  it('stays within 300 lines with 40 haunted criteria and keeps everything in the JSON (Review Focus 3)', () => {
    const criteria = Array.from({ length: 40 }, (_, i) => at(`1.${i + 1}`, `THE System SHALL do thing ${i + 1}.`, i + 1));
    const plans = criteria.map((c) => ({ ...RACE, criterion: c.id }));
    const pairs = plans.map(compiled);
    const results = plans.flatMap((p) => reps(p.criterion, 'doppelganger', [{ asserts: [F] }, { asserts: [F] }, { asserts: [F] }]));
    const { markdown, json } = renderReport({ ...input(), criteria, compiled: pairs, verdicts: verdictsFor(pairs, results, 3) });
    expect(lines(markdown)).toBeLessThanOrEqual(REPORT_MAX_LINES);
    expect(markdown).toContain('haunting-report.json');
    expect(markdown).toContain('- [!!] 1.40 — ');
    expect(json.criteria).toHaveLength(40);
    expect(json.criteria.every((c) => c.pairs[0]!.failing.length === 1)).toBe(true);
    expect(json.truncated).toBeGreaterThan(0);
  });

  it('keeps a fix-ready task for one oversized haunted criterion (review I1)', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ click: { role: 'button' as const, name: `Step ${i}` } }));
    const big: HauntingPlan = { ...RACE, actors: { a: many, b: many }, assert: [0, 1, 2].map((n) => ({ textVisible: `Thing ${n}` })) };
    const plans = [big, { ...big, persona: 'wraith' as const }];
    const pairs = plans.map(compiled);
    const results = plans.flatMap((p) => reps('3.2', p.persona, Array.from({ length: 10 }, () => ({ asserts: [F, F, F] }))));
    const { markdown } = renderReport({ ...input(), run: { ...RUN, reps: 10 }, compiled: pairs, verdicts: verdictsFor(pairs, results, 10) });
    expect(lines(markdown)).toBeLessThanOrEqual(REPORT_MAX_LINES);
    expect(markdown).toContain('### [!!] 3.2 — ');
    expect(markdown).toContain('**Expected:** text "Thing 0" is visible');
    expect(markdown).toContain('**Failed in reps:** 1, 2, 3, 4, 5, 6, 7, 8, 9, 10');
    expect(markdown).toContain('**Actual** (failed 10/10 reps, last seen): ');
  });

  it('says when reps never ran or errored (review I2)', () => {
    const base = input();
    const results = [...reps('2.1', 'banshee', [{ asserts: [F] }]), ...reps('3.2', 'doppelganger', [{ asserts: [F] }, { asserts: [F] }, { outcome: 'timeout', asserts: [] }])];
    const md = renderReport({ ...base, verdicts: verdictsFor(base.compiled, results, 3) }).markdown;
    expect(md).toContain('- banshee failed 1/3 reps (only 1 ran):');
    expect(md).toContain('**Run notes:** `rep 3: target not found: button "Go"`');
  });

  it('never exceeds the cap even when the board alone is too long', () => {
    const criteria = Array.from({ length: 400 }, (_, i) => at(`1.${i + 1}`, `THE System SHALL do thing ${i + 1}.`, i + 1));
    const md = renderReport({ ...input(), criteria }).markdown;
    expect(lines(md)).toBeLessThanOrEqual(REPORT_MAX_LINES);
    expect(md).toContain('haunting-report.json');
  });

  it('makes artifact paths relative with / even when the run is elsewhere (Review Focus 4)', () => {
    const md = renderReport(input({ run: { ...RUN, runDir: '/elsewhere/runs/r1' } })).markdown;
    expect(md).toContain('`../../../../elsewhere/runs/r1/artifacts/3.2__doppelganger__rep1/screenshot-a.png`');
    expect(md).not.toContain('\\');
  });

  it('takes a wordmark override', () => {
    const md = renderReport(input({ wordmark: 'BOO' })).markdown;
    expect(md.startsWith('# Haunting report\n\n```text\nBOO\n```')).toBe(true);
    expect(md).not.toContain('your spec, haunted.');
  });

  it('says so when nothing is haunted or flaky', () => {
    const base = input();
    const pairs = [compiled(simple('2.1', 'banshee'))];
    const md = renderReport({ ...base, compiled: pairs, verdicts: verdictsFor(pairs, reps('2.1', 'banshee', [{ asserts: [T] }, { asserts: [T] }, { asserts: [T] }]), 3) }).markdown;
    expect(md).toContain('- [ok] 2.1 — ');
    expect(md).toContain('No haunted or flaky criteria.');
    expect(md).not.toContain('## Haunted');
  });
});

describe('renderReport: JSON', () => {
  it('is deterministic and matches the schema', () => {
    const a = renderReport(input());
    expect(renderReport(input())).toEqual(a);
    expect(ReportJsonSchema.parse(a.json)).toEqual(a.json);
    expect(a.json.counts).toEqual({ haunted: 1, flaky: 1, inconclusive: 1, clean: 0, notApplicable: 1, notRun: 1 });
    expect(a.json.startedAt).toBe('2026-11-01T12:00:00.000Z');
  });

  it('carries steps, expectations and relative artifacts for each pair', () => {
    const c = renderReport(input()).json.criteria.find((x) => x.id === '3.2')!;
    expect(c).toMatchObject({ verdict: 'haunted', line: 41, requirement: 'Claims' });
    expect(c.pairs[0]).toMatchObject({
      persona: 'doppelganger', verdict: 'haunted', threshold: 2, repsRun: 3,
      expected: ['GET /api/candies/sour-skulls $.claims.length equals 1'],
      steps: { a: ['go to /claims', 'wait at barrier "fire" until every actor reaches it', 'click button "Claim Sour Skulls"'] },
    });
    expect(c.pairs[0]!.failing[0]).toMatchObject({ index: 0, failures: 3, expected: 'GET /api/candies/sour-skulls $.claims.length equals 1' });
    expect(c.pairs[0]!.artifacts[0]).toBe('../../../.poltergeist/runs/r1/artifacts/3.2__doppelganger__rep1/screenshot-a.png');
    expect(renderReport(input()).json.criteria.find((x) => x.id === '6.1')).toMatchObject({ verdict: 'notRun', pairs: [] });
  });
});

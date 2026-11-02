import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { diffVerdicts, readReportJson } from '../../src/report/merge.js';
import { renderReport, type ReportInput } from '../../src/report/render.js';
import { ReportJsonSchema, type ReportJson } from '../../src/report/schema.js';
import { compiled, F, input, RACE, reps, RUN, simple, T, verdictsFor } from './builders.js';

const run = (runId: string) => ({ ...RUN, runId, runDir: `/p/.poltergeist/runs/${runId}` });

/** A later run that re-tests only 3.2 with the doppelganger, which now passes. */
function rerun(previous: ReportJson, runId: string, over: Partial<ReportInput> = {}) {
  const pairs = [compiled(RACE)];
  const verdicts = verdictsFor(pairs, reps('3.2', 'doppelganger', [{ asserts: [T] }, { asserts: [T] }, { asserts: [T] }]), 3);
  const rendered = renderReport({ ...input(), compiled: pairs, verdicts, run: run(runId), previous, ...over });
  ReportJsonSchema.parse(rendered.json);
  return rendered;
}
const row = (json: ReportJson, id: string) => json.criteria.find((c) => c.id === id)!;

describe('renderReport with a previous report', () => {
  it('subset run carries every criterion it did not run', () => {
    const first = renderReport(input()).json;
    const { json, markdown } = rerun(first, 'r2');
    expect(json.criteria.map((c) => c.id)).toEqual(['2.1', '3.2', '4.1', '5.1', '6.1']);
    expect(row(json, '2.1')).toMatchObject({ verdict: 'flaky', carriedFrom: 'r1' });
    expect(row(json, '2.1').pairs.every((p) => p.carriedFrom === 'r1')).toBe(true);
    expect(row(json, '3.2').verdict).toBe('clean');
    expect(row(json, '3.2').carriedFrom).toBeUndefined();
    expect(row(json, '6.1')).toMatchObject({ verdict: 'notRun', pairs: [] });
    expect(json.counts).toMatchObject({ flaky: 1, clean: 1, inconclusive: 1, notApplicable: 1, notRun: 1 });
    expect(markdown).toMatch(/\[~~\] 2\.1 — .* _\(earlier run `r1`\)_/);
    expect(markdown).toContain('_Merged: 3 criteria kept from earlier runs; re-run them to refresh._');
  });

  it('re-run criterion rolls up over carried personas', () => {
    const pairs = [compiled(RACE), compiled(simple('3.2', 'banshee'))];
    const results = [...reps('3.2', 'doppelganger', [{ asserts: [F] }, { asserts: [F] }, { asserts: [F] }]), ...reps('3.2', 'banshee', [{ asserts: [F] }, { asserts: [F] }, { asserts: [F] }])];
    const first = renderReport({ ...input(), compiled: pairs, verdicts: verdictsFor(pairs, results, 3) }).json;
    const { json, markdown } = rerun(first, 'r2');
    const r = row(json, '3.2');
    expect(r.verdict).toBe('haunted');
    expect(r.pairs.find((p) => p.persona === 'banshee')).toMatchObject({ verdict: 'haunted', carriedFrom: 'r1' });
    expect(r.pairs.find((p) => p.persona === 'doppelganger')).toMatchObject({ verdict: 'clean' });
    expect(r.pairs.find((p) => p.persona === 'doppelganger')!.carriedFrom).toBeUndefined();
    expect(markdown).toMatch(/#### banshee — .* _\(earlier run `r1`\)_/);
  });

  it('carriedFrom survives a second subset run', () => {
    const r2 = rerun(renderReport(input()).json, 'r2').json;
    const r3 = rerun(r2, 'r3').json;
    expect(row(r3, '2.1').carriedFrom).toBe('r1');
    expect(row(r3, '2.1').pairs[0]!.carriedFrom).toBe('r1');
  });

  it('carries nothing and diffs nothing when the target changed', () => {
    const first = { ...renderReport(input()).json, target: 'http://127.0.0.1:5000' };
    const { json, markdown } = rerun(first, 'r2');
    expect(row(json, '2.1')).toMatchObject({ verdict: 'notRun', pairs: [] });
    expect(markdown).not.toContain('_Merged:');
    expect(diffVerdicts(first, json)).toEqual([]);
  });

  it("carries nothing and diffs nothing for a criterion whose text changed", () => {
    const first = renderReport(input()).json;
    const edited = input().criteria.map((c) => (c.id === '2.1' || c.id === '3.2' ? { ...c, text: `${c.text} Edited.` } : c));
    const { json } = rerun(first, 'r2', { criteria: edited });
    expect(row(json, '2.1')).toMatchObject({ verdict: 'notRun', pairs: [] });
    expect(diffVerdicts(first, json)).toEqual([]);
  });
});

describe('diffVerdicts', () => {
  it('reports criterion and persona changes for what ran this time', () => {
    const first = renderReport(input()).json;
    expect(diffVerdicts(first, rerun(first, 'r2').json)).toEqual([
      { id: '3.2', from: 'haunted', to: 'clean', personas: [{ persona: 'doppelganger', from: 'haunted', to: 'clean' }] },
    ]);
  });

  it('is empty for an unchanged re-run and without a previous report', () => {
    const first = renderReport(input()).json;
    const again = renderReport({ ...input(), run: run('r2'), previous: first }).json;
    expect(diffVerdicts(first, again)).toEqual([]);
    expect(diffVerdicts(undefined, first)).toEqual([]);
  });
});

describe('readReportJson', () => {
  it('reads a report back and treats a missing, corrupt or other-version file as none', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'merge-'));
    try {
      expect(await readReportJson(dir)).toBeUndefined();
      await writeFile(join(dir, 'haunting-report.json'), '{not json');
      expect(await readReportJson(dir)).toBeUndefined();
      await writeFile(join(dir, 'haunting-report.json'), '{"version":2}');
      expect(await readReportJson(dir)).toBeUndefined();
      const json = renderReport(input()).json;
      await writeFile(join(dir, 'haunting-report.json'), JSON.stringify(json));
      expect(await readReportJson(dir)).toEqual(json);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

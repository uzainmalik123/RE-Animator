import type { SummonResult } from '@poltergeist/core';
import { describe, expect, it } from 'vitest';
import { capIds, capText, MAX_TEXT, summarize } from '../src/format.js';

describe('capText', () => {
  it('keeps short text', () => expect(capText('abc')).toBe('abc'));
  it('cuts long text to the cap with a note', () => {
    const out = capText('x'.repeat(7000));
    expect(out.length).toBeLessThanOrEqual(MAX_TEXT);
    expect(out).toMatch(/truncated \(\d+ more chars\)$/);
  });
});

describe('capIds', () => {
  it('caps at 20 and says how many more', () => {
    const ids = Array.from({ length: 25 }, (_, i) => `1.${i + 1}`);
    const out = capIds(ids);
    expect(out).toHaveLength(21);
    expect(out.at(-1)).toBe('+5 more');
  });
  it('keeps short lists', () => expect(capIds(['1.1'])).toEqual(['1.1']));
});

describe('summarize', () => {
  const result = {
    runId: 'r1',
    runDir: '/w/.poltergeist/runs/r1',
    specDir: '/w/.kiro/specs/s',
    target: 'http://127.0.0.1:4000',
    criteria: [{ id: '3.1' }, { id: '3.2' }, { id: '3.3' }],
    compiled: [],
    verdicts: {
      reps: 3,
      threshold: 2,
      pairs: [],
      criteria: [
        { criterion: '3.1', verdict: 'clean', personas: {} },
        { criterion: '3.2', verdict: 'haunted', personas: {} },
      ],
      counts: {},
    },
    haunted: ['3.2'],
    allResetsFailed: false,
    reportPaths: { markdownPath: '/w/.kiro/specs/s/haunting-report.md', jsonPath: '/w/.kiro/specs/s/haunting-report.json' }, changes: [],
    merged: [{ id: '3.1', verdict: 'clean' }, { id: '3.2', verdict: 'haunted' }, { id: '3.3', verdict: 'notRun' }],
  } as unknown as SummonResult;

  it('reports counts, haunted ids, a relative report path and a hint', () => {
    const s = summarize(result, '/w');
    expect(s.status).toBe('finished');
    expect(s.runId).toBe('r1');
    expect(s.haunted).toEqual(['3.2']);
    expect(s.counts).toMatchObject({ haunted: 1, clean: 1, notRun: 1, flaky: 0 });
    expect(s.reportPath).toBe('.kiro/specs/s/haunting-report.md');
    expect(s.hint).toContain('3.2');
  });

  it('counts the merged verdicts, so a carried haunted persona still shows (review I1)', () => {
    const s = summarize({ ...result, verdicts: { ...result.verdicts, criteria: [{ criterion: '3.1', verdict: 'clean', personas: {} }, { criterion: '3.2', verdict: 'notApplicable', personas: {} }] } } as unknown as SummonResult, '/w');
    expect(s.counts).toMatchObject({ haunted: 1, clean: 1, notRun: 1, notApplicable: 0 });
  });

  it('flags a run where every reset failed', () => {
    const s = summarize({ ...result, haunted: [], allResetsFailed: true, resetError: 'boom' }, '/w');
    expect(s.error).toContain('boom');
  });

  it('lists criteria whose verdict changed and says which ones are fixed', () => {
    const fixed = {
      ...result,
      haunted: [],
      changes: [
        { id: '3.2', from: 'haunted', to: 'clean', personas: [{ persona: 'doppelganger', from: 'haunted', to: 'clean' }] },
        { id: '3.1', from: 'clean', to: 'clean', personas: [{ persona: 'wraith', from: 'flaky', to: 'clean' }] },
      ],
      previousRunId: 'r0',
    } as unknown as SummonResult;
    const s = summarize(fixed, '/w');
    expect(s.changes).toEqual([{ id: '3.2', from: 'haunted', to: 'clean' }]);
    expect(s.previousRunId).toBe('r0');
    expect(s.hint).toMatch(/^Fixed: 3\.2\./);
  });

  it('has no changes key when only persona verdicts moved', () => {
    const s = summarize({ ...result, changes: [{ id: '3.1', from: 'clean', to: 'clean', personas: [{ persona: 'wraith', from: 'flaky', to: 'clean' }] }] } as unknown as SummonResult, '/w');
    expect(s).not.toHaveProperty('changes');
    expect(s).not.toHaveProperty('previousRunId');
  });
});

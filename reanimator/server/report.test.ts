import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readWounds } from './report.js';

const COUNTS = { haunted: 1, flaky: 0, inconclusive: 0, clean: 1, notApplicable: 0, notRun: 0 };

function pair(persona: string, verdict: string, extra: object = {}) {
  return {
    persona, verdict, reason: `${persona} ${verdict}`, notes: [], reps: 3, repsRun: 3, threshold: 2,
    expected: ['the list shows one entry'], failing: [], failedReps: [],
    outcomes: { completed: 3, timeout: 0, planError: 0, systemError: 0, voided: 0, missing: 0 },
    artifacts: [], ...extra,
  };
}

function report(criteria: object[], counts = COUNTS) {
  return { version: 1, runId: 'run-1', target: 'http://127.0.0.1:5555', model: 'm', reps: 3, startedAt: '', specFile: 'requirements.md', counts, criteria, truncated: 0 };
}

async function write(body: string): Promise<string> {
  const p = join(await mkdtemp(join(tmpdir(), 'r3-report-')), 'haunting-report.json');
  await writeFile(p, body);
  return p;
}

describe('readWounds', () => {
  it('makes one wound per haunted pair', async () => {
    const haunted = pair('wraith', 'haunted', {
      steps: { a: ['fill Name', 'double-click Sign'], b: ['open /'] },
      failing: [{ index: 0, type: 'count', expected: 'one entry', failures: 3, lastDetail: 'saw 2' }],
      artifacts: ['runs/run-1/a.png'],
    });
    const p = await write(JSON.stringify(report([
      { id: '1.2', requirement: 'Signing', text: 'record only one entry', line: 9, verdict: 'haunted', pairs: [haunted, pair('lich', 'clean')] },
    ])));
    const { counts, wounds } = await readWounds(p);
    expect(counts).toEqual(COUNTS);
    expect(wounds).toEqual([{
      criterion: '1.2', text: 'record only one entry', persona: 'wraith', reason: 'wraith haunted',
      steps: ['fill Name', 'double-click Sign', 'B: open /'], expected: ['the list shows one entry'],
      failing: ['one entry (3×): saw 2'], artifacts: ['runs/run-1/a.png'], carried: false,
    }]);
  });

  it('gives no wounds for flaky or clean pairs, but keeps the counts', async () => {
    const counts = { ...COUNTS, haunted: 0, flaky: 1 };
    const p = await write(JSON.stringify(report([
      { id: '1.1', requirement: 'Signing', text: 't', line: 8, verdict: 'flaky', pairs: [pair('wraith', 'flaky'), pair('lich', 'clean')] },
    ], counts)));
    expect(await readWounds(p)).toEqual({ counts, wounds: [] });
  });

  it('refuses a report from another run (a stale one left beside the spec)', async () => {
    const p = await write(JSON.stringify(report([])));
    await expect(readWounds(p, 'run-2')).rejects.toThrow('the engine wrote no readable report');
    await expect(readWounds(p, 'run-1')).resolves.toMatchObject({ wounds: [] });
  });

  it('refuses a missing or unreadable report', async () => {
    await expect(readWounds('/nonexistent/haunting-report.json')).rejects.toThrow('the engine wrote no readable report');
    await expect(readWounds(await write('not json'))).rejects.toThrow('the engine wrote no readable report');
    await expect(readWounds(await write(JSON.stringify({ version: 2, criteria: [] })))).rejects.toThrow('the engine wrote no readable report');
  });
});

import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FrameMark } from '../../src/live/index.js';
import type { SummonEvent } from '../../src/summon/types.js';

export const A = '3.2__doppelganger__r1__a';
export const B = '3.1__wraith__r1__a';

/** A finished run: 3.2's doppelganger (ghost A) fails an assertion, 3.1's wraith (ghost B) passes. */
export const runEvents: SummonEvent[] = [
  {
    type: 'run.started', t: 1000, runId: '20261102-120000-abcd', runDir: '/home/someone/project/.poltergeist/runs/20261102-120000-abcd', specDir: '/spec', target: 'http://127.0.0.1:4000',
    criteria: ['3.1', '3.2'], personas: ['wraith', 'doppelganger'], reps: 1,
  },
  { type: 'rep.started', t: 1010, rep: 1 },
  { type: 'ghost.spawned', t: 1020, ghostId: A, criterion: '3.2', persona: 'doppelganger', rep: 1, actor: 'a' },
  { type: 'ghost.spawned', t: 1020, ghostId: B, criterion: '3.1', persona: 'wraith', rep: 1, actor: 'a' },
  { type: 'assert.result', t: 1500, criterion: '3.2', persona: 'doppelganger', rep: 1, index: 0, ok: false, detail: 'two claims' },
  { type: 'rep.finished', t: 1600, rep: 1, outcomes: { completed: 2, timeout: 0, planError: 0, systemError: 0 } },
  { type: 'verdict.criterion', t: 1610, criterion: '3.1', verdict: 'clean' },
  { type: 'verdict.criterion', t: 1610, criterion: '3.2', verdict: 'haunted' },
  {
    type: 'run.finished', t: 1620, runId: '20261102-120000-abcd', haunted: ['3.2'], durationMs: 620,
    counts: { clean: 1, haunted: 1, flaky: 0, inconclusive: 0, notApplicable: 2, uncompilable: 0 },
  },
] as SummonEvent[];

export const FRAME_BYTES = 1000;

/** Writes the run with `framesPerGhost` jpgs of `FRAME_BYTES` each for A and B, plus run-only files a bundle must not copy. */
export async function writeRunDir(framesPerGhost = 6): Promise<{ dir: string; marks: FrameMark[] }> {
  const dir = await mkdtemp(join(tmpdir(), 'rec-run-'));
  await writeFile(join(dir, 'events.ndjson'), runEvents.map((e) => `${JSON.stringify(e)}\n`).join(''));
  const marks: FrameMark[] = [];
  for (const ghostId of [A, B]) {
    await mkdir(join(dir, 'frames', ghostId), { recursive: true });
    for (let seq = 0; seq < framesPerGhost; seq++) {
      await writeFile(join(dir, 'frames', ghostId, `${String(seq).padStart(5, '0')}.jpg`), Buffer.alloc(FRAME_BYTES, seq));
      marks.push({ ghostId, seq, t: 1100 + seq * 50 });
    }
  }
  await writeFile(join(dir, 'frames.ndjson'), marks.map((m) => `${JSON.stringify(m)}\n`).join(''));
  await writeFile(join(dir, 'verdicts.json'), '{"reps":1}\n');
  await writeFile(join(dir, 'run.json'), '{"config":{"accounts":[]}}\n');
  await mkdir(join(dir, 'plans'));
  await writeFile(join(dir, 'plans', '3.2__doppelganger.json'), '{}');
  await mkdir(join(dir, 'artifacts', 'x'), { recursive: true });
  await writeFile(join(dir, 'artifacts', 'x', 'trace-a.zip'), 'secret');
  return { dir, marks };
}

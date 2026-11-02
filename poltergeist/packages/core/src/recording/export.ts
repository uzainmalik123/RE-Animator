import { copyFile, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { framePath, timelineDuration, type FrameMark } from '../live/index.js';
import type { SummonEvent } from '../summon/types.js';
import type { PairVerdict } from '../verdicts/types.js';
import { loadRecording, RecordingError } from './load.js';

/** `recording.json`: what a bundle holds, and the label that it is a recording (Req 11.4). */
export type RecordingManifest = {
  format: 'poltergeist-recording';
  version: 1;
  recorded: true;
  runId: string;
  target: string;
  criteria: string[];
  personas: string[];
  reps: number;
  /** Absent when the run never finished (aborted). */
  counts?: Record<PairVerdict, number>;
  haunted: string[];
  durationMs: number;
  frames: number;
  droppedFrames: number;
  exportedAt: string;
};

export type ExportOptions = {
  runDir: string;
  outDir: string;
  /** Default 50 MB (PRD F15). */
  maxBytes?: number;
  now?: () => Date;
  onWarning?: (m: string) => void;
};

export const DEFAULT_MAX_BYTES = 50 * 1024 * 1024;

const mb = (n: number) => (n / 1024 / 1024).toFixed(1);
const ndjson = (rows: readonly unknown[]) => rows.map((r) => `${JSON.stringify(r)}\n`).join('');
const json = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`;

async function readOptional(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw err;
  }
}

/** Refuses an out dir inside (or equal to) the run folder, or one that exists and isn't empty. Writes nothing. */
async function checkOutDir(runDir: string, outDir: string): Promise<void> {
  const rel = relative(runDir, outDir);
  if (rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))) throw new RecordingError(`--out ${outDir} is inside the run folder`);
  let entries: string[];
  try {
    if (!(await stat(outDir)).isDirectory()) throw new RecordingError(`--out ${outDir} exists and is not a directory`);
    entries = await readdir(outDir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw err;
  }
  if (entries.length) throw new RecordingError(`--out ${outDir} is not empty; choose a new folder`);
}

/** Ghosts that failed an assertion: their frames are the haunted evidence and are never thinned. */
function failedGhosts(events: readonly SummonEvent[]): Set<string> {
  const failed = new Set<string>();
  const pairs = new Set(events.flatMap((e) => (e.type === 'assert.result' && !e.ok ? [`${e.criterion}|${e.persona}|${e.rep}`] : [])));
  for (const e of events) if (e.type === 'ghost.spawned' && pairs.has(`${e.criterion}|${e.persona}|${e.rep}`)) failed.add(e.ghostId);
  return failed;
}

/**
 * Exports a run folder as a static recording (PRD F15, D-43): `recording.json`, `events.ndjson`, `frames.ndjson`,
 * the kept `frames/**` and `verdicts.json`. Never `run.json`, plans, scout or artifacts. Over `maxBytes`, every other
 * unprotected frame per ghost is dropped, repeatedly; each ghost's last frame and a failed ghost's frames are kept.
 * Everything is decided before the first write, so a refusal writes nothing.
 */
export async function exportRecording(opts: ExportOptions): Promise<{ outDir: string; bytes: number; manifest: RecordingManifest }> {
  const runDir = resolve(opts.runDir);
  const outDir = resolve(opts.outDir);
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  await checkOutDir(runDir, outDir);
  const rec = await loadRecording(runDir, { onWarning: opts.onWarning });
  const started = rec.events.find((e) => e.type === 'run.started');
  const finished = rec.events.find((e) => e.type === 'run.finished');
  if (started?.type !== 'run.started') throw new RecordingError('no run.started'); // loadRecording guarantees one

  const size = new Map<FrameMark, number>();
  for (const f of rec.frames) size.set(f, (await stat(join(runDir, framePath(f.ghostId, f.seq)))).size);
  const eventsText = ndjson(rec.events);
  const verdicts = await readOptional(join(runDir, 'verdicts.json'));
  const exportedAt = (opts.now ?? (() => new Date()))().toISOString();
  const manifestFor = (kept: readonly FrameMark[]): RecordingManifest => ({
    format: 'poltergeist-recording', version: 1, recorded: true, runId: rec.runId, target: started.target,
    criteria: started.criteria, personas: started.personas, reps: started.reps,
    ...(finished?.type === 'run.finished' ? { counts: finished.counts } : {}),
    haunted: finished?.type === 'run.finished' ? finished.haunted : [],
    durationMs: timelineDuration(rec.timeline), frames: kept.length, droppedFrames: rec.frames.length - kept.length, exportedAt,
  });
  const total = (kept: readonly FrameMark[]) =>
    Buffer.byteLength(eventsText) + Buffer.byteLength(ndjson(kept)) + Buffer.byteLength(json(manifestFor(kept))) +
    (verdicts === undefined ? 0 : Buffer.byteLength(verdicts)) + kept.reduce((n, f) => n + (size.get(f) ?? 0), 0);

  // Thin: per ghost (frames in seq order), drop every other unprotected frame until under the cap or nothing can go.
  const failed = failedGhosts(rec.events);
  const byGhost = new Map<string, FrameMark[]>();
  for (const f of [...rec.frames].sort((a, b) => a.seq - b.seq)) byGhost.set(f.ghostId, [...(byGhost.get(f.ghostId) ?? []), f]);
  let kept = new Set(rec.frames);
  while (total([...kept]) > maxBytes) {
    const next = new Set(kept);
    for (const [ghostId, frames] of byGhost) {
      if (failed.has(ghostId)) continue;
      const droppable = frames.filter((f) => kept.has(f)).slice(0, -1);
      droppable.forEach((f, i) => i % 2 === 1 && next.delete(f));
      if (droppable.length === 1) next.delete(droppable[0]!); // the last unprotected one goes too
    }
    if (next.size === kept.size) {
      throw new RecordingError(`recording is ${mb(total([...kept]))} MB, over the ${mb(maxBytes)} MB cap even after thinning`);
    }
    kept = next;
  }

  const frames = rec.frames.filter((f) => kept.has(f));
  const manifest = manifestFor(frames);
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'events.ndjson'), eventsText);
  await writeFile(join(outDir, 'frames.ndjson'), ndjson(frames));
  if (verdicts !== undefined) await writeFile(join(outDir, 'verdicts.json'), verdicts);
  for (const f of frames) {
    await mkdir(join(outDir, 'frames', f.ghostId), { recursive: true });
    await copyFile(join(runDir, framePath(f.ghostId, f.seq)), join(outDir, framePath(f.ghostId, f.seq)));
  }
  await writeFile(join(outDir, 'recording.json'), json(manifest));
  return { outDir, bytes: total(frames), manifest };
}

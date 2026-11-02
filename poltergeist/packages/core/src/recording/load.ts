import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { buildTimeline, estimateFrameTimes, framePath, type FrameMark, type TimelineEntry } from '../live/index.js';
import type { SummonEvent } from '../summon/types.js';

/** A folder that can't be read as a recording. */
export class RecordingError extends Error {
  override name = 'RecordingError';
}

/** A run folder or an exported bundle, read back (PRD F15, D-43). */
export type Recording = {
  dir: string;
  runId: string;
  events: SummonEvent[];
  frames: FrameMark[];
  /** No `frames.ndjson` (a run from before F15): frame times are `estimateFrameTimes`'. */
  estimatedFrames: boolean;
  timeline: TimelineEntry[];
  readFrame(f: Pick<FrameMark, 'ghostId' | 'seq'>): Promise<Buffer>;
};

const missing = (err: unknown) => (err as NodeJS.ErrnoException).code === 'ENOENT';

/** Parses ndjson, skipping (and reporting) lines that don't parse, such as a line torn by a killed process. */
function parseLines<T>(text: string, file: string, onWarning?: (m: string) => void): T[] {
  const out: T[] = [];
  let bad = 0;
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line) as T);
    } catch {
      bad++;
    }
  }
  if (bad) onWarning?.(`${file}: skipped ${bad} unreadable line${bad === 1 ? '' : 's'}`);
  return out;
}

async function exists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch (err) {
    if (missing(err)) return false;
    throw err;
  }
}

/** Every `frames/<ghostId>/<seq>.jpg` on disk. */
async function listFrames(dir: string): Promise<{ ghostId: string; seq: number }[]> {
  let ghosts: string[];
  try {
    ghosts = await readdir(join(dir, 'frames'));
  } catch (err) {
    if (missing(err)) return [];
    throw err;
  }
  const out: { ghostId: string; seq: number }[] = [];
  for (const ghostId of ghosts) {
    const files = await readdir(join(dir, 'frames', ghostId)).catch(() => [] as string[]);
    for (const f of files) {
      const m = /^(\d{5})\.jpg$/.exec(f);
      if (m) out.push({ ghostId, seq: Number(m[1]) });
    }
  }
  return out;
}

/**
 * Reads `events.ndjson` (required, with a `run.started`) and the frames: `frames.ndjson` when present, else the jpgs
 * on disk with estimated times. Marks whose jpg is missing are dropped. Touches no target, LLM or browser (Req 11.4).
 */
export async function loadRecording(dir: string, opts: { onWarning?: (m: string) => void } = {}): Promise<Recording> {
  let text: string;
  try {
    text = await readFile(join(dir, 'events.ndjson'), 'utf8');
  } catch (err) {
    if (missing(err)) throw new RecordingError(`no events.ndjson in ${dir}: not a run folder or recording`);
    throw err;
  }
  const events = parseLines<SummonEvent>(text, 'events.ndjson', opts.onWarning).filter(
    (e) => e !== null && typeof e === 'object' && typeof e.type === 'string' && typeof e.t === 'number',
  );
  const started = events.find((e) => e.type === 'run.started');
  if (!started) throw new RecordingError(`events.ndjson in ${dir} has no run.started`);

  const onDisk = await listFrames(dir);
  const present = new Set(onDisk.map((f) => framePath(f.ghostId, f.seq)));
  let frames: FrameMark[];
  let estimatedFrames = false;
  if (await exists(join(dir, 'frames.ndjson'))) {
    frames = parseLines<FrameMark>(await readFile(join(dir, 'frames.ndjson'), 'utf8'), 'frames.ndjson', opts.onWarning).filter(
      (f) => f !== null && typeof f === 'object' && typeof f.ghostId === 'string' && Number.isInteger(f.seq) && typeof f.t === 'number' && present.has(framePath(f.ghostId, f.seq)),
    );
  } else {
    frames = estimateFrameTimes(events, onDisk);
    estimatedFrames = true;
  }

  return {
    dir,
    runId: started.runId,
    events,
    frames,
    estimatedFrames,
    timeline: buildTimeline(events, frames),
    readFrame: (f) => readFile(join(dir, framePath(f.ghostId, f.seq))),
  };
}

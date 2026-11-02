import type { SummonEvent } from '../summon/types.js';
import { initialLiveState, reduceLive } from './reduce.js';
import type { LiveState } from './types.js';

/** Where a frame jpg sits in time: one `frames.ndjson` line (F15, D-43). */
export type FrameMark = { ghostId: string; seq: number; t: number };

/** `at` is milliseconds since the recording's first event. */
export type TimelineEntry = { at: number; event: SummonEvent } | { at: number; frame: FrameMark };

/**
 * Puts a recording's events and frames on one clock (PRD F15, D-43). Sorted by `at`, stable, an event before a frame
 * at the same `at`. A frame whose ghost never spawned is dropped. Pure and isomorphic, like `reduceLive`.
 */
export function buildTimeline(events: readonly SummonEvent[], frames: readonly FrameMark[]): TimelineEntry[] {
  const t0 = events[0]?.t ?? 0;
  const at = (t: number) => Math.max(0, t - t0);
  const spawned = new Set(events.flatMap((e) => (e.type === 'ghost.spawned' ? [e.ghostId] : [])));
  const entries: TimelineEntry[] = [
    ...events.map((event) => ({ at: at(event.t), event })),
    ...frames.filter((f) => spawned.has(f.ghostId)).map((frame) => ({ at: at(frame.t), frame })),
  ];
  // Array#sort is stable, and events come first, so ties keep events before frames and each list's own order.
  return entries.sort((x, y) => x.at - y.at);
}

export const timelineDuration = (tl: readonly TimelineEntry[]): number => tl.at(-1)?.at ?? 0;

/**
 * The live state `ms` into the recording, for a scrubber. A frame becomes a `ghost.frame` only when `frameData`
 * returns its base64 jpeg; without it the result at the end equals `foldLive(events)`.
 */
export function stateAt(tl: readonly TimelineEntry[], ms: number, frameData?: (f: FrameMark) => string | undefined): LiveState {
  let s = initialLiveState();
  for (const e of tl) {
    if (e.at > ms) break;
    if ('event' in e) {
      s = reduceLive(s, e.event);
      continue;
    }
    const jpegBase64 = frameData?.(e.frame);
    if (jpegBase64 !== undefined) s = reduceLive(s, { type: 'ghost.frame', ghostId: e.frame.ghostId, seq: e.frame.seq, jpegBase64, t: e.frame.t });
  }
  return s;
}

/**
 * Frame times for a run recorded before `frames.ndjson` existed: each ghost's frames, in `seq` order, spread evenly
 * between its `ghost.spawned` and its rep's `rep.finished` (or the last event). Frames of unknown ghosts are dropped.
 */
export function estimateFrameTimes(events: readonly SummonEvent[], frames: readonly { ghostId: string; seq: number }[]): FrameMark[] {
  const last = events.at(-1)?.t ?? 0;
  const repEnd = new Map<number, number>();
  const spawns = new Map<string, { t: number; rep: number }>();
  for (const e of events) {
    if (e.type === 'rep.finished') repEnd.set(e.rep, e.t);
    if (e.type === 'ghost.spawned') spawns.set(e.ghostId, { t: e.t, rep: e.rep });
  }
  const byGhost = new Map<string, number[]>();
  for (const f of frames) if (spawns.has(f.ghostId)) byGhost.set(f.ghostId, [...(byGhost.get(f.ghostId) ?? []), f.seq]);
  return [...byGhost].flatMap(([ghostId, seqs]) => {
    const spawn = spawns.get(ghostId)!;
    const end = Math.max(spawn.t, repEnd.get(spawn.rep) ?? last);
    return seqs.sort((a, b) => a - b).map((seq, i) => ({ ghostId, seq, t: Math.round(spawn.t + ((end - spawn.t) * (i + 1)) / (seqs.length + 1)) }));
  });
}

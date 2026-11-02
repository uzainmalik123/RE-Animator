import { setTimeout as delay } from 'node:timers/promises';
import type { Recording, SummonEvent } from '@poltergeist/core';

export type PlayOptions = {
  /** 1–16: the recording's own gaps are divided by it. */
  speed: number;
  publish(e: SummonEvent): void;
  signal?: AbortSignal;
  /** Tests only. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
};

const realSleep = (ms: number, signal?: AbortSignal) => delay(ms, undefined, { signal }).then(() => undefined);

/**
 * Re-publishes a recording on its own clock (PRD F15, D-43): events as recorded, frames as `ghost.frame` read from
 * disk (a frame that can't be read is skipped). Touches no target, LLM or browser. Rejects when `signal` aborts.
 */
export async function playRecording(rec: Recording, opts: PlayOptions): Promise<void> {
  const sleep = opts.sleep ?? realSleep;
  let prev = rec.timeline[0]?.at ?? 0;
  for (const entry of rec.timeline) {
    opts.signal?.throwIfAborted();
    const gap = (entry.at - prev) / opts.speed;
    prev = entry.at;
    if (gap > 0) await sleep(gap, opts.signal);
    opts.signal?.throwIfAborted();
    if ('event' in entry) {
      opts.publish(entry.event);
      continue;
    }
    let jpeg: Buffer;
    try {
      jpeg = await rec.readFrame(entry.frame);
    } catch {
      continue;
    }
    const { ghostId, seq, t } = entry.frame;
    opts.publish({ type: 'ghost.frame', ghostId, seq, t, jpegBase64: jpeg.toString('base64') });
  }
}

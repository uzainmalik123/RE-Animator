// A recorded session (R11, D-R22): every event the backend streamed during a real run, stamped with
// when it was sent, so a static page can replay the real UI on it. Frames sit beside it as jpgs.
import { isAutopsy } from './autopsy.js';
import type { AttackEvent } from './attack.js';
import type { SpellEvent } from './grimoire.js';
import type { RitualEvent } from './ritual.js';

export const RECORDING_FORMAT = 'reanimator-recording';

export type Manifest = { format: typeof RECORDING_FORMAT; version: 1; recordedAt: string };

export type Stream = 'ritual' | 'attack' | 'spell';
const STREAMS: readonly string[] = ['ritual', 'attack', 'spell'] satisfies Stream[];

// `t` is ms since the recorder started; `id` is the ritual, attack or spell the event belongs to.
export type RecordedLine = { t: number; stream: Stream; id: string; event: RitualEvent | AttackEvent | SpellEvent };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

export function isManifest(v: unknown): v is Manifest {
  return isObject(v) && v.format === RECORDING_FORMAT && v.version === 1 && typeof v.recordedAt === 'string';
}

// events.ndjson → lines, blank lines skipped. A malformed line is an error, never skipped silently.
export function parseLines(text: string): RecordedLine[] {
  const lines: RecordedLine[] = [];
  text.split('\n').forEach((raw, i) => {
    if (raw.trim() === '') return;
    let v: unknown;
    try {
      v = JSON.parse(raw);
    } catch {
      v = null;
    }
    if (!isObject(v) || typeof v.t !== 'number' || typeof v.stream !== 'string' || !STREAMS.includes(v.stream) || typeof v.id !== 'string' || !isObject(v.event)) {
      throw new Error(`bad recording line ${i + 1}`);
    }
    // R8: the panel renders an autopsy field by field, so a malformed one is a bad line, not a crash later.
    if (v.stream === 'ritual' && v.event.type === 'autopsy' && !isAutopsy(v.event.autopsy)) throw new Error(`bad recording line ${i + 1}`);
    lines.push(v as RecordedLine);
  });
  return lines;
}

const MIN_SECRET = 8;

// Before a line is published: every secret value the server holds becomes [secret], and the
// recording machine's home directory becomes ~. Values are matched as they appear inside JSON.
export function redact(json: string, home: string, secrets: readonly string[] = []): string {
  const inJson = (v: string) => JSON.stringify(v).slice(1, -1);
  let out = json;
  for (const v of secrets) if (v.length >= MIN_SECRET) out = out.split(inJson(v)).join('[secret]');
  if (home !== '' && home !== '/') out = out.split(inJson(home)).join('~');
  return out;
}

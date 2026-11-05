import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { AttackEvent } from '../shared/attack.js';
import { RECORDING_FORMAT, redact, type Manifest, type Stream } from '../shared/recording.js';
import type { AttacksApi, GrimoireApi, RitualsApi } from './app.js';
import type { LogSource } from './sse.js';

const CAP_BYTES = 50 * 1024 * 1024;

// R11 (D-R22): with REANIMATOR_RECORD set, every event the backend streams is copied into a recording
// (recording.json, events.ndjson, frames/) that the static replay plays. It records what really ran;
// it never deletes, so it refuses a directory that already holds a recording. It runs inside the
// live streams' listeners, so it never throws there: a failed write stops the recording, not the run.
export class Recorder {
  private readonly t0: number;
  private readonly watched = new Set<string>();
  private frameBytes = 0;
  private warned = false;
  private stopped = false;

  constructor(private readonly o: { dir: string; home: string; secrets?: readonly string[]; now?: () => number; capBytes?: number; warn?: (m: string) => void }) {
    mkdirSync(o.dir, { recursive: true });
    if (existsSync(this.events)) throw new Error(`a recording already exists in ${o.dir}; move it away first`);
    this.t0 = this.now();
    const manifest: Manifest = { format: RECORDING_FORMAT, version: 1, recordedAt: new Date(this.t0).toISOString() };
    writeFileSync(join(o.dir, 'recording.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    writeFileSync(this.events, '');
  }

  private get events(): string {
    return join(this.o.dir, 'events.ndjson');
  }

  private now(): number {
    return (this.o.now ?? Date.now)();
  }

  private warn(m: string): void {
    (this.o.warn ?? console.warn)(m);
  }

  // Run one write; on failure, warn and record nothing more this session.
  private guard(write: () => void): void {
    if (this.stopped) return;
    try {
      write();
    } catch (e) {
      this.stopped = true;
      this.warn(`recording stopped: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Record one stream from its first event (those already sent are replayed), once per id.
  watch<E>(stream: Stream, id: string, src: LogSource<E>): void {
    const key = `${stream}:${id}`;
    if (this.watched.has(key)) return;
    this.watched.add(key);
    let next = 0;
    const write = (e: E, index: number) => {
      if (index < next) return;
      next = index + 1;
      const line = JSON.stringify({ t: this.now() - this.t0, stream, id, event: e });
      this.guard(() => appendFileSync(this.events, `${redact(line, this.o.home, this.o.secrets)}\n`));
    };
    src.subscribe(id, write);
    src.events(id)?.log.forEach((e, i) => write(e, i));
  }

  frame(attackId: string, ghostId: string, seq: number, jpeg: Buffer): void {
    if (this.frameBytes + jpeg.length > (this.o.capBytes ?? CAP_BYTES)) {
      if (!this.warned) this.warn(`recording: frame cap reached, later frames are not kept`);
      this.warned = true;
      return;
    }
    this.guard(() => {
      const file = join(this.o.dir, 'frames', attackId, ghostId, `${seq}.jpg`);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, jpeg);
      this.frameBytes += jpeg.length;
    });
  }
}

// The values of every env var whose name says it holds a secret (keys, tokens, passwords).
export const secretValues = (env: NodeJS.ProcessEnv): string[] =>
  Object.entries(env)
    .filter(([k, v]) => v && /KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|AUTH|SESSION|COOKIE/i.test(k))
    .map(([, v]) => v!);

type Apis = { rituals: RitualsApi; attacks: AttacksApi; grimoire: GrimoireApi };

// The same APIs, but every ritual, attack and spell they start (or rejoin) is recorded, and so is
// every frame of the app the attack streams.
export function recordApis(apis: Apis, rec: Recorder): Apis {
  const { rituals, attacks, grimoire } = apis;
  const frames = (id: string) =>
    attacks.subscribe(id, (e: AttackEvent) => {
      if (e.type !== 'engine' || e.event.type !== 'frame') return;
      const { ghostId, seq } = e.event;
      // A frame the engine no longer has (or can't read) is simply not kept.
      void attacks.frame(id, ghostId, seq).then(
        (jpeg) => jpeg && rec.frame(id, ghostId, seq, jpeg),
        () => undefined,
      );
    });
  return {
    rituals: {
      events: (id, after) => rituals.events(id, after),
      subscribe: (id, fn) => rituals.subscribe(id, fn),
      start: (req) => {
        const s = rituals.start(req);
        rec.watch('ritual', s.id, rituals);
        return s;
      },
    },
    attacks: {
      events: (id, after) => attacks.events(id, after),
      subscribe: (id, fn) => attacks.subscribe(id, fn),
      frame: (id, g, seq) => attacks.frame(id, g, seq),
      start: (ritualId, o) => {
        const s = attacks.start(ritualId, o);
        if ('id' in s && !('busy' in s)) frames(s.id);
        if ('id' in s) rec.watch('attack', s.id, attacks);
        return s;
      },
    },
    grimoire: {
      events: (id, after) => grimoire.events(id, after),
      subscribe: (id, fn) => grimoire.subscribe(id, fn),
      stop: (id) => grimoire.stop(id),
      start: (ritualId, o) => {
        const s = grimoire.start(ritualId, o);
        if ('id' in s) rec.watch('spell', s.id, grimoire);
        return s;
      },
    },
  };
}

// The grimoire (R7, D-R21): one spell at a time, cast by the real Kiro agent on the current ritual's
// revived body. A spell is one kiro-cli turn; later spells on the same ritual resume its
// conversation. Never while Death attacks (Kiro would edit the body under him), and a new ritual (or
// shutdown) breaks the spell off first, through Rituals' onRelease.
import { randomUUID } from 'node:crypto';
import type { HealTarget } from '../shared/attack.js';
import { spellOver, type SpellEvent } from '../shared/grimoire.js';
import { kiroEnv } from './env.js';
import { EventLog } from './event-log.js';
import { runKiro } from './kiro.js';
import type { Rituals } from './ritual.js';

const STOPPED = 'stopped: the spell was broken off';

interface Current {
  id: string;
  log: EventLog<SpellEvent>;
  abort: AbortController;
  finished: Promise<void>;
}

export class Grimoire {
  private current: Current | null = null;
  // The ritual whose conversation Kiro holds, and whether a turn of it has reached Kiro.
  private memory: { ritual: string; cast: boolean } | null = null;
  private readonly o: {
    rituals: Pick<Rituals, 'body'>;
    attacking: () => boolean;
    cli: string;
    env: NodeJS.ProcessEnv;
    kiro?: typeof runKiro;
  };

  constructor(o: Grimoire['o']) {
    this.o = o;
  }

  start(ritualId: string, o: { text: string; heal?: HealTarget }): { id: string } | { busy: true; id: string } | { notRisen: true } | { attacking: true } {
    if (this.busy()) return { busy: true, id: this.current!.id };
    // Kiro only needs the revived dir: a body that is down (a heal broke it) can still be healed.
    const body = this.o.rituals.body(ritualId);
    if (!body) return { notRisen: true };
    if (this.o.attacking()) return { attacking: true };
    if (this.memory?.ritual !== ritualId) this.memory = { ritual: ritualId, cast: false };
    const memory = this.memory;
    const cur: Current = { id: randomUUID(), log: new EventLog(spellOver), abort: new AbortController(), finished: Promise.resolve() };
    this.current = cur;
    const emit = (e: SpellEvent) => cur.log.push(e);
    const { signal } = cur.abort;
    const kiro = this.o.kiro ?? runKiro;
    cur.finished = (async () => {
      try {
        emit({ type: 'cast', text: o.text, heal: o.heal ?? null });
        const resume = memory.cast;
        memory.cast = true;
        const r = await kiro({ cli: this.o.cli, cwd: body.revivedDir, text: o.text, resume, env: kiroEnv(this.o.env), signal, onEvent: emit });
        if (signal.aborted) return emit({ type: 'failed', reason: STOPPED });
        emit(r.ok ? { type: 'sealed', stopReason: r.stopReason } : { type: 'failed', reason: r.error });
      } catch (e) {
        emit({ type: 'failed', reason: signal.aborted ? STOPPED : e instanceof Error ? e.message : String(e) });
      }
    })();
    return { id: cur.id };
  }

  busy(): boolean {
    return this.current !== null && !this.current.log.done;
  }

  events(id: string, after = -1): { log: SpellEvent[]; done: boolean } | null {
    const cur = this.current;
    return cur && cur.id === id ? cur.log.events(after) : null;
  }

  subscribe(id: string, fn: (e: SpellEvent, index: number) => void): () => void {
    const cur = this.current;
    return cur && cur.id === id ? cur.log.subscribe(fn) : () => {};
  }

  // Break off the current spell (its kiro-cli group is killed) and wait for it to end. With an id,
  // only if that spell is the current one.
  async stop(id?: string): Promise<void> {
    const cur = this.current;
    if (!cur || (id !== undefined && cur.id !== id)) return;
    cur.abort.abort();
    await cur.finished;
  }
}

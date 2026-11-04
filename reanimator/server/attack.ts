// Death's attack (R3, D-R17): one attack at a time, on the current risen ritual. It prepares the
// chart and config, runs the real Poltergeist engine, forwards its progress, and reads its report.
// A new ritual (or shutdown) stops it first, through Rituals' onRelease.
import { randomUUID } from 'node:crypto';
import { attackOver, type AttackEvent } from '../shared/attack.js';
import { prepareAttack } from './chart.js';
import { runEngine } from './engine.js';
import { engineEnv } from './env.js';
import { EventLog } from './event-log.js';
import type { Rituals } from './ritual.js';
import { readWounds } from './report.js';

const STOPPED = 'stopped: a new ritual began';

interface Current {
  id: string;
  log: EventLog<AttackEvent>;
  abort: AbortController;
  finished: Promise<void>;
}

export class Attacks {
  private current: Current | null = null;
  private readonly o: {
    rituals: Pick<Rituals, 'risen'>;
    homeRoot: string;
    cli: string;
    env: NodeJS.ProcessEnv;
    engine?: typeof runEngine;
    read?: typeof readWounds;
  };

  constructor(o: Attacks['o']) {
    this.o = o;
  }

  start(ritualId: string, only?: string[]): { id: string } | { busy: true; id: string } | { notRisen: true } {
    if (this.current && !this.current.log.done) return { busy: true, id: this.current.id };
    const risen = this.o.rituals.risen(ritualId);
    if (!risen) return { notRisen: true };
    const cur: Current = { id: randomUUID(), log: new EventLog(attackOver), abort: new AbortController(), finished: Promise.resolve() };
    this.current = cur;
    const emit = (e: AttackEvent) => cur.log.push(e);
    const { signal } = cur.abort;
    const engine = this.o.engine ?? runEngine;
    const read = this.o.read ?? readWounds;
    cur.finished = (async () => {
      emit({ type: 'summoned', origin: risen.origin, only: only ?? null });
      try {
        const prep = await prepareAttack({ fixture: risen.fixture, revivedDir: risen.revivedDir, origin: risen.origin, homeRoot: this.o.homeRoot });
        const r = await engine({
          cli: this.o.cli,
          ...prep,
          env: engineEnv(this.o.env),
          only,
          signal,
          onEvent: (event) => emit({ type: 'engine', event }),
        });
        if (signal.aborted) return emit({ type: 'failed', reason: STOPPED });
        if (r.code !== 0 && r.code !== 1) return emit({ type: 'failed', reason: r.error ?? 'the engine failed' });
        // Exit 1 with no run is a crash, and the spec folder may still hold an earlier run's report.
        if (r.runId === null) return emit({ type: 'failed', reason: `the engine wrote no readable report: ${r.error ?? 'no run'}` });
        emit({ type: 'finished', ...(await read(r.reportPath, r.runId)) });
      } catch (e) {
        emit({ type: 'failed', reason: signal.aborted ? STOPPED : e instanceof Error ? e.message : String(e) });
      }
    })();
    return { id: cur.id };
  }

  events(id: string, after = -1): { log: AttackEvent[]; done: boolean } | null {
    const cur = this.current;
    return cur && cur.id === id ? cur.log.events(after) : null;
  }

  subscribe(id: string, fn: (e: AttackEvent, index: number) => void): () => void {
    const cur = this.current;
    return cur && cur.id === id ? cur.log.subscribe(fn) : () => {};
  }

  // Abort the running attack (its engine's process group is killed) and wait for it to end.
  async stop(): Promise<void> {
    const cur = this.current;
    if (!cur) return;
    cur.abort.abort();
    await cur.finished;
  }
}

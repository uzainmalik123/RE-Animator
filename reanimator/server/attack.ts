// Death's attack (R3, D-R17): one attack at a time, on the current risen ritual. It prepares the
// chart and config, runs the real Poltergeist engine, forwards its progress, and reads its report.
// A new ritual (or shutdown) stops it first, through Rituals' onRelease. R5 (D-R20): any attack after
// a ritual's first raises the body again on real vitals (a heal may have edited it), and a heal runs
// the engine on one wound only; the merged report is the ledger, and a wound closes only when its
// pair really ran clean in this run.
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { attackOver, woundKey, type AttackEvent, type HealTarget, type Wound } from '../shared/attack.js';
import { chartDir, prepareAttack } from './chart.js';
import { runEngine } from './engine.js';
import { engineEnv } from './env.js';
import { EventLog } from './event-log.js';
import type { Rituals } from './ritual.js';
import { openWounds, readWounds } from './report.js';

const STOPPED = 'stopped: a new ritual began';

interface Current {
  id: string;
  log: EventLog<AttackEvent>;
  abort: AbortController;
  finished: Promise<void>;
  runDir: string | null;
}

// A ghost id as the engine writes it (`<criterion>__<persona>__r<rep>__<actor>`): one path segment.
// What Attacks remembers of the current ritual: how often Death came, the wounds healed since, and
// the wounds a heal left unproven. A flaky or inconclusive re-run replaces the haunted pair in the
// report, but proves nothing: the wound stays open (and can be dared again) until a run settles it.
interface Memory {
  ritual: string;
  attacks: number;
  healed: Map<string, Wound>;
  unproven: Map<string, Wound>;
}

const GHOST_ID = /^[A-Za-z0-9._-]+$/;

const withUnproven = (wounds: Wound[], memory: Memory): Wound[] => {
  const open = new Set(wounds.map(woundKey));
  return [...wounds, ...[...memory.unproven.values()].filter((w) => !open.has(woundKey(w)))];
};

export class Attacks {
  private current: Current | null = null;
  private memory: Memory | null = null;
  private readonly o: {
    rituals: Pick<Rituals, 'body' | 'reraise'>;
    homeRoot: string;
    cli: string;
    env: NodeJS.ProcessEnv;
    engine?: typeof runEngine;
    read?: typeof readWounds;
    // R7: Kiro is editing the body (a spell is being cast); Death waits for the seal.
    casting?: () => boolean;
    // R7: Kiro has edited this ritual's body, so even a first attack must raise it again.
    edited?: (ritualId: string) => boolean;
  };

  constructor(o: Attacks['o']) {
    this.o = o;
  }

  start(ritualId: string, o: { only?: string[]; heal?: HealTarget } = {}): { id: string } | { busy: true; id: string } | { notRisen: true } | { casting: true } | { noChart: true } {
    if (this.busy()) return { busy: true, id: this.current!.id };
    if (this.o.casting?.()) return { casting: true };
    const body = this.o.rituals.body(ritualId);
    if (!body) return { notRisen: true };
    // R9: a grave nobody charted gives Death nothing to test it against.
    if (!body.fixture.chartDir) return { noChart: true };
    if (this.memory?.ritual !== ritualId) this.memory = { ritual: ritualId, attacks: 0, healed: new Map(), unproven: new Map() };
    const memory = this.memory;
    const again = memory.attacks++ > 0 || body.origin === null || this.o.edited?.(ritualId) === true;
    const cur: Current = { id: randomUUID(), log: new EventLog(attackOver), abort: new AbortController(), finished: Promise.resolve(), runDir: null };
    this.current = cur;
    const emit = (e: AttackEvent) => cur.log.push(e);
    const { signal } = cur.abort;
    const engine = this.o.engine ?? runEngine;
    const read = this.o.read ?? readWounds;
    const heal = o.heal ?? null;
    cur.finished = (async () => {
      try {
        const before = withUnproven(await openWounds(join(chartDir(body.revivedDir), 'haunting-report.json')), memory);
        emit({ type: 'summoned', origin: body.origin ?? '', only: o.only ?? null, heal, body: body.revivedDir, wounds: before, healed: [...memory.healed.values()] });
        const target = heal ? before.find((w) => woundKey(w) === woundKey(heal)) : undefined;
        if (heal && !target) return emit({ type: 'failed', reason: 'that wound is not open' });
        let origin = body.origin;
        if (again) {
          const r = await this.o.rituals.reraise(ritualId, (result) => emit({ type: 'pulse', result }), signal);
          if (signal.aborted) return emit({ type: 'failed', reason: STOPPED });
          if ('failed' in r) return emit({ type: 'failed', reason: `the heal broke the body: ${r.failed}` });
          origin = r.origin;
          emit({ type: 'reraised', origin });
        }
        if (origin === null) return emit({ type: 'failed', reason: 'the body is down' });
        const prep = await prepareAttack({ fixture: body.fixture, revivedDir: body.revivedDir, origin, homeRoot: this.o.homeRoot });
        const r = await engine({
          cli: this.o.cli,
          ...prep,
          env: engineEnv(this.o.env),
          only: heal ? [heal.criterion] : o.only,
          personas: heal ? [heal.persona] : undefined,
          signal,
          onEvent: (event) => emit({ type: 'engine', event }),
          onRun: (runDir) => (cur.runDir = runDir),
        });
        if (signal.aborted) return emit({ type: 'failed', reason: STOPPED });
        if (r.code !== 0 && r.code !== 1) return emit({ type: 'failed', reason: r.error ?? 'the engine failed' });
        // Exit 1 with no run is a crash, and the spec folder may still hold an earlier run's report.
        if (r.runId === null) return emit({ type: 'failed', reason: `the engine wrote no readable report: ${r.error ?? 'no run'}` });
        const { counts, wounds, pairs } = await read(r.reportPath, r.runId);
        let verdict: string | null = null;
        if (heal && target) {
          // Only a pair that really ran in this run counts: a carried or missing one proves nothing.
          const p = pairs[woundKey(heal)];
          verdict = p && !p.carried ? p.verdict : 'notRun';
          if (verdict !== 'clean' && verdict !== 'haunted' && verdict !== 'notRun') memory.unproven.set(woundKey(heal), target);
        }
        // An unproven wound is settled by the next run of its pair: clean heals it, haunted reopens it.
        for (const [key, w] of memory.unproven) {
          const p = pairs[key];
          if (!p || p.carried || (key === (heal && woundKey(heal)) && verdict !== 'clean' && verdict !== 'haunted')) continue;
          memory.unproven.delete(key);
          if (p.verdict === 'clean') memory.healed.set(key, w);
        }
        if (heal && target && verdict === 'clean') memory.healed.set(woundKey(heal), target);
        for (const w of wounds) memory.healed.delete(woundKey(w));
        emit({ type: 'finished', counts, wounds: withUnproven(wounds, memory), healed: [...memory.healed.values()], heal: heal && verdict ? { ...heal, verdict } : null });
      } catch (e) {
        emit({ type: 'failed', reason: signal.aborted ? STOPPED : e instanceof Error ? e.message : String(e) });
      }
    })();
    return { id: cur.id };
  }

  busy(): boolean {
    return this.current !== null && !this.current.log.done;
  }

  events(id: string, after = -1): { log: AttackEvent[]; done: boolean } | null {
    const cur = this.current;
    return cur && cur.id === id ? cur.log.events(after) : null;
  }

  subscribe(id: string, fn: (e: AttackEvent, index: number) => void): () => void {
    const cur = this.current;
    return cur && cur.id === id ? cur.log.subscribe(fn) : () => {};
  }

  // R4: one jpeg the engine captured of the app under attack, from the current attack's run dir only.
  async frame(id: string, ghostId: string, seq: number): Promise<Buffer | null> {
    const cur = this.current;
    if (!cur || cur.id !== id || !cur.runDir) return null;
    if (!GHOST_ID.test(ghostId) || ghostId === '.' || ghostId === '..' || !Number.isSafeInteger(seq) || seq < 0) return null;
    return readFile(join(cur.runDir, 'frames', ghostId, `${String(seq).padStart(5, '0')}.jpg`)).catch(() => null);
  }

  // Abort the running attack (its engine's process group is killed) and wait for it to end.
  async stop(): Promise<void> {
    const cur = this.current;
    if (!cur) return;
    cur.abort.abort();
    await cur.finished;
  }
}

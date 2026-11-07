// The ritual (R2, D-R15): prove the corpse is dead, lay the remedy over a fresh copy, and raise it
// with real vitals. Rituals keeps one ritual at a time, its event log (for SSE replay) and the
// revived app, which stays up for Death (R3) until the next ritual or shutdown; Death is stopped first.
import { randomUUID } from 'node:crypto';
import { cp, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { RitualEvent, VitalResult } from '../shared/ritual.js';
import type { RunningApp } from './exec.js';
import type { Fixture } from './fixtures.js';
import { GraveError } from './grave.js';
import { runVitals, type VitalDeps } from './vitals.js';

const firstLine = (s: string) => s.split('\n').find((l) => l.trim() !== '')?.trim() ?? '';

async function countFiles(dir: string): Promise<number> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries.filter((e) => e.isFile()).length;
}

async function layRemedy(fixture: Fixture, revived: string): Promise<{ files: number }> {
  if (!fixture.remedyDir) throw new Error(`fixture ${fixture.name} has no remedy`);
  await cp(fixture.remedyDir, revived, { recursive: true, force: true });
  return { files: await countFiles(fixture.remedyDir) };
}

// `signal` stops the ritual early (the backend shutting down, or a new ritual replacing it).
export async function performRitual(
  fixture: Fixture,
  deps: VitalDeps,
  workdir: string,
  emit: (e: RitualEvent) => void,
  signal?: AbortSignal,
): Promise<RunningApp | null> {
  emit({ type: 'started', repo: fixture.name, diedIn: fixture.diedIn });
  const corpse = join(workdir, 'corpse');
  await cp(fixture.corpseDir, corpse, { recursive: true });
  const exam = await runVitals('corpse', corpse, fixture, deps, emit, signal);
  if (signal?.aborted) {
    emit({ type: 'failed', phase: 'corpse', reason: 'stopped: the ritual was stopped' });
    return null;
  }
  if (exam.ok) {
    await exam.app?.stop();
    emit({ type: 'failed', phase: 'corpse', reason: 'not dead: every vital passed before the remedy' });
    return null;
  }
  const revived = join(workdir, 'revived');
  await cp(fixture.corpseDir, revived, { recursive: true });
  const remedy: { files: number; rites?: string[] } = fixture.remedy ? await fixture.remedy(revived) : await layRemedy(fixture, revived);
  emit({ type: 'remedy', ...remedy });
  // A grave no rite fits would only die the same way again (D-R11: no raise is pretended).
  if (remedy.rites?.length === 0) {
    emit({ type: 'failed', phase: 'revived', reason: 'no rite fits this death' });
    return null;
  }
  let lastDetail = '';
  const raise = await runVitals('revived', revived, fixture, deps, (e) => {
    if (e.type === 'vital') lastDetail = e.result.detail;
    emit(e);
  }, signal);
  if (!raise.ok || !raise.app) {
    emit({ type: 'failed', phase: 'revived', reason: `${raise.failed ?? 'ritual'}: ${firstLine(lastDetail) || 'failed'}` });
    return null;
  }
  emit({ type: 'risen', origin: raise.app.origin });
  return raise.app;
}

interface Current {
  id: string;
  log: RitualEvent[];
  done: boolean;
  listeners: Set<(e: RitualEvent, index: number) => void>;
  workdir: string | null;
  fixture: Fixture | null;
  app: RunningApp | null;
  // Where the body first rose; a re-raise serves it there again (D-R20).
  port: number | null;
  abort: AbortController;
  finished: Promise<void>;
}

// What the user asked to raise: a prepared grave by id (R6), a GitHub grave's URL (R9), or nothing
// for our own practice corpse. At most one of the two is set.
export interface RitualRequest {
  repo?: string;
  grave?: string;
}

const terminal = (e: RitualEvent) => e.type === 'risen' || e.type === 'failed';

export class Rituals {
  private current: Current | null = null;
  private readonly fixture: (req: RitualRequest, workdir: string, signal: AbortSignal) => Promise<Fixture>;
  private readonly deps: VitalDeps;
  private readonly workRoot: string;
  private readonly onRelease: () => Promise<void>;

  // `onRelease` runs first whenever a ritual is let go (Death's attack stops before its target does).
  // `fixture` may clone into the work dir (a grave, R9); the signal stops it when the ritual is let go.
  constructor(o: { fixture: (req: RitualRequest, workdir: string, signal: AbortSignal) => Promise<Fixture>; deps: VitalDeps; workRoot?: string; onRelease?: () => Promise<void> }) {
    this.fixture = o.fixture;
    this.deps = o.deps;
    this.workRoot = o.workRoot ?? tmpdir();
    this.onRelease = o.onRelease ?? (() => Promise.resolve());
  }

  // A busy answer carries the running ritual's id, so a reloaded page can reattach to it.
  start(req: RitualRequest = {}): { id: string } | { busy: true; id: string } {
    if (this.current && !this.current.done) return { busy: true, id: this.current.id };
    const previous = this.current;
    const cur: Current = { id: randomUUID(), log: [], done: false, listeners: new Set(), workdir: null, fixture: null, app: null, port: null, abort: new AbortController(), finished: Promise.resolve() };
    this.current = cur;
    const emit = (e: RitualEvent) => {
      if (cur.done) return;
      cur.log.push(e);
      if (terminal(e)) cur.done = true;
      for (const fn of cur.listeners) fn(e, cur.log.length - 1);
    };
    const stopping = previous ? this.release(previous) : Promise.resolve();
    cur.finished = (async () => {
      try {
        await stopping;
        cur.workdir = await mkdtemp(join(this.workRoot, 'reanimator-'));
        cur.fixture = await this.fixture(req, cur.workdir, cur.abort.signal);
        cur.app = await performRitual(cur.fixture, this.deps, cur.workdir, emit, cur.abort.signal);
        cur.port = cur.app?.port ?? null;
      } catch (e) {
        // A grave that can't be opened never reached its corpse's vitals.
        emit({ type: 'failed', phase: e instanceof GraveError ? 'corpse' : 'revived', reason: e instanceof Error ? e.message : String(e) });
      }
    })();
    return { id: cur.id };
  }

  // The events after index `after` (all of them when omitted); null for an unknown or replaced ritual.
  events(id: string, after = -1): { log: RitualEvent[]; done: boolean } | null {
    const cur = this.current;
    if (!cur || cur.id !== id) return null;
    return { log: cur.log.slice(after + 1), done: cur.done };
  }

  // What Death needs from the current ritual once it has risen (R3); null otherwise.
  risen(id: string): { origin: string; revivedDir: string; fixture: Fixture } | null {
    const cur = this.current;
    if (!cur || cur.id !== id || !cur.app || !cur.workdir || !cur.fixture || cur.log.at(-1)?.type !== 'risen') return null;
    return { origin: cur.app.origin, revivedDir: join(cur.workdir, 'revived'), fixture: cur.fixture };
  }

  // The revived body of a ritual that has risen (R5), even while its app is down after a failed re-raise.
  body(id: string): { revivedDir: string; fixture: Fixture; origin: string | null } | null {
    const cur = this.current;
    if (!cur || cur.id !== id || !cur.workdir || !cur.fixture || cur.log.at(-1)?.type !== 'risen') return null;
    return { revivedDir: join(cur.workdir, 'revived'), fixture: cur.fixture, origin: cur.app?.origin ?? null };
  }

  // Raise the same revived body again (R5, D-R20): a heal may have edited it, and the app doesn't
  // reload. The old app stops, the four vitals run on the revived dir, and a failure leaves it down.
  // It stays on its first port: Poltergeist only carries an earlier report's rows for the same target,
  // so a new origin would drop every other wound from the ledger. A port taken meanwhile fails serve.
  async reraise(id: string, onVital: (r: VitalResult) => void, signal?: AbortSignal): Promise<{ origin: string } | { failed: string }> {
    const cur = this.current;
    const body = this.body(id);
    if (!cur || !body) return { failed: 'the ritual has not risen' };
    const old = cur.app;
    cur.app = null;
    await old?.stop();
    let lastDetail = '';
    const r = await runVitals('revived', body.revivedDir, body.fixture, this.deps, (e) => {
      if (e.type !== 'vital') return;
      lastDetail = e.result.detail;
      onVital(e.result);
    }, signal, cur.port ?? undefined);
    // A ritual let go meanwhile must not get an app back (nothing would ever stop it).
    if (this.current !== cur) {
      await r.app?.stop();
      return { failed: 'stopped: the ritual was let go' };
    }
    if (!r.ok || !r.app) return { failed: `${r.failed ?? 'ritual'}: ${firstLine(lastDetail) || 'failed'}` };
    cur.app = r.app;
    return { origin: r.app.origin };
  }

  subscribe(id: string, fn: (e: RitualEvent, index: number) => void): () => void {
    const cur = this.current;
    if (!cur || cur.id !== id) return () => {};
    cur.listeners.add(fn);
    return () => cur.listeners.delete(fn);
  }

  async dispose(): Promise<void> {
    const cur = this.current;
    this.current = null;
    if (cur) await this.release(cur);
  }

  private async release(cur: Current): Promise<void> {
    await this.onRelease().catch(() => undefined);
    cur.listeners.clear();
    cur.abort.abort(); // a ritual still running stops at its current command instead of finishing first
    await cur.finished;
    await cur.app?.stop();
    cur.app = null;
    if (cur.workdir) await rm(cur.workdir, { recursive: true, force: true });
  }
}

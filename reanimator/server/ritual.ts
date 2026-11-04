// The ritual (R2, D-R15): prove the corpse is dead, lay the remedy over a fresh copy, and raise it
// with real vitals. Rituals keeps one ritual at a time, its event log (for SSE replay) and the
// revived app, which stays up for Death (R3) until the next ritual or shutdown.
import { randomUUID } from 'node:crypto';
import { cp, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { RitualEvent } from '../shared/ritual.js';
import type { RunningApp } from './exec.js';
import type { Fixture } from './fixtures.js';
import { runVitals, type VitalDeps } from './vitals.js';

const firstLine = (s: string) => s.split('\n').find((l) => l.trim() !== '')?.trim() ?? '';

async function countFiles(dir: string): Promise<number> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries.filter((e) => e.isFile()).length;
}

export async function performRitual(fixture: Fixture, deps: VitalDeps, workdir: string, emit: (e: RitualEvent) => void): Promise<RunningApp | null> {
  emit({ type: 'started', repo: fixture.name, diedIn: fixture.diedIn });
  const corpse = join(workdir, 'corpse');
  await cp(fixture.corpseDir, corpse, { recursive: true });
  const exam = await runVitals('corpse', corpse, fixture, deps, emit);
  if (exam.ok) {
    await exam.app?.stop();
    emit({ type: 'failed', phase: 'corpse', reason: 'not dead: every vital passed before the remedy' });
    return null;
  }
  const revived = join(workdir, 'revived');
  await cp(fixture.corpseDir, revived, { recursive: true });
  await cp(fixture.remedyDir, revived, { recursive: true, force: true });
  emit({ type: 'remedy', files: await countFiles(fixture.remedyDir) });
  let lastDetail = '';
  const raise = await runVitals('revived', revived, fixture, deps, (e) => {
    if (e.type === 'vital') lastDetail = e.result.detail;
    emit(e);
  });
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
  app: RunningApp | null;
  finished: Promise<void>;
}

const terminal = (e: RitualEvent) => e.type === 'risen' || e.type === 'failed';

export class Rituals {
  private current: Current | null = null;
  private readonly fixture: () => Promise<Fixture>;
  private readonly deps: VitalDeps;
  private readonly workRoot: string;

  constructor(o: { fixture: () => Promise<Fixture>; deps: VitalDeps; workRoot?: string }) {
    this.fixture = o.fixture;
    this.deps = o.deps;
    this.workRoot = o.workRoot ?? tmpdir();
  }

  start(): { id: string } | { busy: true } {
    if (this.current && !this.current.done) return { busy: true };
    const previous = this.current;
    const cur: Current = { id: randomUUID(), log: [], done: false, listeners: new Set(), workdir: null, app: null, finished: Promise.resolve() };
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
        cur.app = await performRitual(await this.fixture(), this.deps, cur.workdir, emit);
      } catch (e) {
        emit({ type: 'failed', phase: 'revived', reason: e instanceof Error ? e.message : String(e) });
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
    cur.listeners.clear();
    await cur.finished;
    await cur.app?.stop();
    cur.app = null;
    if (cur.workdir) await rm(cur.workdir, { recursive: true, force: true });
  }
}

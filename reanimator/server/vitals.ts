// The four vitals (R2, design §2): install, build, serve, render. They run in order and stop at the
// first failure; every result is emitted as it lands, so the heart monitor beats on real checks.
import { VITALS, type Phase, type RitualEvent, type VitalName, type VitalResult } from '../shared/ritual.js';
import type { RunningApp, freePort, runCommand, startApp, waitForHttp } from './exec.js';
import type { Fixture } from './fixtures.js';
import type { renderCheck } from './render-check.js';

export interface VitalDeps {
  runCommand: typeof runCommand;
  startApp: typeof startApp;
  freePort: typeof freePort;
  waitForHttp: typeof waitForHttp;
  renderCheck: typeof renderCheck;
}

export const TIMEOUTS: Record<VitalName, number> = { install: 120_000, build: 120_000, serve: 15_000, render: 20_000 };

const COMMANDS = {
  install: ['npm', 'install', '--no-audit', '--no-fund'],
  build: ['npm', 'run', 'build', '--if-present'],
} as const;

const timedOut = (v: VitalName) => `timed out after ${TIMEOUTS[v] / 1000}s`;

export async function runVitals(
  phase: Phase,
  workdir: string,
  fixture: Fixture,
  deps: VitalDeps,
  emit: (e: RitualEvent) => void,
  signal?: AbortSignal,
  port?: number,
): Promise<{ ok: boolean; app: RunningApp | null; failed: VitalName | null }> {
  let app: RunningApp | null = null;
  for (const vital of VITALS) {
    const t0 = Date.now();
    let ok = false;
    let detail: string;
    try {
      if (signal?.aborted) {
        detail = 'stopped: the ritual was stopped';
      } else if (vital === 'install' || vital === 'build') {
        const r = await deps.runCommand([...COMMANDS[vital]], { cwd: workdir, timeoutMs: TIMEOUTS[vital], signal });
        ok = r.code === 0;
        detail = r.timedOut ? timedOut(vital) : r.output.trim();
      } else if (vital === 'serve') {
        // `port` re-raises a body where it stood (R5): the engine merges its reports per target.
        app = deps.startApp(fixture.serve, { cwd: workdir, port: port ?? (await deps.freePort()) });
        const up = await deps.waitForHttp(app.origin, { timeoutMs: TIMEOUTS.serve, exited: app.exited });
        ok = up.ok;
        detail = up.ok ? `${app.origin} answered ${up.detail}` : `${up.detail}\n${app.output().trim()}`.trim();
      } else {
        const r = await deps.renderCheck(app!.origin, { timeoutMs: TIMEOUTS.render });
        ok = r.ok;
        detail = r.detail;
      }
    } catch (e) {
      // A check that throws is a failed vital; the app it may have started must not be orphaned.
      ok = false;
      detail = e instanceof Error ? e.message : String(e);
    }
    const result: VitalResult = { vital, ok, detail, ms: Date.now() - t0 };
    emit({ type: 'vital', phase, result });
    if (!ok) {
      await app?.stop();
      return { ok: false, app: null, failed: vital };
    }
  }
  return { ok: true, app, failed: null };
}

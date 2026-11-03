import { basename } from 'node:path';
import type { SummonEvent } from '../summon/types.js';

/**
 * An event fit for strangers: `run.started` loses the local paths (evidence resolves against `runDir: '.'`),
 * everything else is returned as is (D-43 export, F21 sandbox).
 */
export function publicEvent(e: SummonEvent): SummonEvent {
  return e.type === 'run.started' ? { ...e, runDir: '.', specDir: basename(e.specDir) } : e;
}

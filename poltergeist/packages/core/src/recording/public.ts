import { basename } from 'node:path';
import type { SummonEvent } from '../summon/types.js';

/**
 * An event fit for strangers: `run.started` loses the local paths (evidence resolves against `runDir: '.'`) and a
 * failed reset loses its error text (it can name local files); everything else is returned as is (D-43 export, D-49).
 */
export function publicEvent(e: SummonEvent): SummonEvent {
  if (e.type === 'run.started') return { ...e, runDir: '.', specDir: basename(e.specDir) };
  if (e.type === 'reset.finished' && e.error !== undefined) return { ...e, error: 'reset failed' };
  return e;
}

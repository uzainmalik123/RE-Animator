import { resolve } from 'node:path';
import { applyInit, type InitResult } from './apply.js';
import { planInit, type InitOptions } from './plan.js';

export { DEFAULT_TARGET, planInit } from './plan.js';
export type { InitOptions, McpEntry, PlannedFile } from './plan.js';
export { InitError } from './apply.js';
export type { InitOutcome, InitResult } from './apply.js';

/** `poltergeist init`: wires a project into Kiro (Req 10.3, D-41). Throws `ConfigError` or `InitError` before writing anything. */
export async function init(opts: InitOptions): Promise<InitResult> {
  const files = await planInit(opts);
  return applyInit(resolve(opts.dir), files, opts.force ?? false);
}

export { main } from './main.js';
export type { MainDeps } from './main.js';
export { exitCodeFor } from './exit.js';
export { HELP_TEXT, parseCliArgs } from './args.js';
export type { CliArgs } from './args.js';
export { DEFAULT_TARGET, init, InitError, planInit } from './init/index.js';
export type { InitOptions, InitOutcome, InitResult, McpEntry, PlannedFile } from './init/index.js';
export { buildPower, MCP_TOOLS, planPower, PowerError, POWER_KEYWORDS, validatePower } from './power/index.js';
export type { PowerFiles, PowerOptions } from './power/index.js';

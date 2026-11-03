import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SKILL_PATH, validatePower, type PowerFiles } from './validate.js';

/** A bundle that breaks the Power format, or an `--out` folder that isn't new or empty. */
export class PowerError extends Error {
  override name = 'PowerError';
}

/** The tools `poltergeist-mcp` serves (D-38); the Done-when checks this against the live server. */
export const MCP_TOOLS = ['list_criteria', 'summon_ghosts', 'get_run_status', 'get_haunting_report', 'rehaunt'] as const;

export type PowerOptions = {
  /** Defaults to this checkout's `packages/mcp/bin/poltergeist-mcp.js`. */
  mcpBin?: string;
  /** Defaults to this checkout's `integrations/kiro/power`. */
  templatesDir?: string;
};

const DEFAULT_MCP_BIN = fileURLToPath(new URL('../../../mcp/bin/poltergeist-mcp.js', import.meta.url));
const DEFAULT_TEMPLATES = fileURLToPath(new URL('../../../../integrations/kiro/power/', import.meta.url));
const VERBATIM = ['plugin.json', SKILL_PATH];

/** The Power bundle for this checkout (D-46): the templates with the server's absolute path filled in, validated. */
export async function planPower(opts: PowerOptions): Promise<PowerFiles> {
  const templates = opts.templatesDir ?? DEFAULT_TEMPLATES;
  const read = (rel: string) => readFile(join(templates, rel), 'utf8');
  const files: PowerFiles = {};
  for (const rel of VERBATIM) files[rel] = await read(rel);
  let mcp: { mcpServers?: { poltergeist?: { args?: unknown } } };
  try {
    mcp = JSON.parse(await read('mcp.json'));
  } catch (err) {
    throw new PowerError(`mcp.json template: ${err instanceof Error ? err.message : String(err)}`);
  }
  const server = mcp.mcpServers?.poltergeist;
  if (server && Array.isArray(server.args)) server.args[0] = resolve(opts.mcpBin ?? DEFAULT_MCP_BIN);
  files['mcp.json'] = `${JSON.stringify(mcp, null, 2)}\n`;
  const problems = validatePower(files, { tools: MCP_TOOLS });
  if (problems.length) throw new PowerError(`the Power bundle is invalid: ${problems.join('; ')}`);
  return files;
}

async function checkOut(out: string): Promise<void> {
  let info;
  try {
    info = await stat(out);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw err;
  }
  if (!info.isDirectory()) throw new PowerError(`--out ${out} is not a folder`);
  if ((await readdir(out)).length) throw new PowerError(`--out ${out} is not empty; choose a new folder`);
}

/** `poltergeist power --out <dir>`: writes the bundle into a new or empty folder. Refuses before writing anything. */
export async function buildPower(opts: PowerOptions & { out: string }): Promise<{ out: string; files: string[] }> {
  const out = resolve(opts.out);
  const files = await planPower(opts);
  await checkOut(out);
  const paths = Object.keys(files).sort();
  for (const rel of paths) {
    const dest = join(out, rel);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, files[rel]!, { flag: 'wx' });
  }
  return { out, files: paths };
}

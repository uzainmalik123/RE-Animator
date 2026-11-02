import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseConfig } from '@poltergeist/core';

export type InitOptions = {
  /** The project to wire up; resolved against cwd. */
  dir: string;
  /** The app's local origin (D-05). Default `DEFAULT_TARGET`. */
  target?: string;
  /** Spec folder the hook names; omitted, the hook means whichever spec's tasks just ran. */
  spec?: string;
  /** Write the agent hook. Default true. */
  hook?: boolean;
  /** Replace files that differ (Req 10.3). Default false. */
  force?: boolean;
  /** Defaults to this checkout's `packages/mcp/bin/poltergeist-mcp.js`. */
  mcpBin?: string;
  /** Defaults to this checkout's `integrations/kiro`. */
  templatesDir?: string;
};

export type McpEntry = { command: 'node'; args: string[]; env: Record<string, string>; autoApprove: string[] };

export const MCP_PATH = '.kiro/settings/mcp.json';

export type PlannedFile =
  | {
      path: string;
      kind: 'text';
      content: string;
      /** The user's file once it exists: created, never replaced, not even by `--force`. */
      scaffold?: boolean;
      /** A trailing section the user owns; `--force` keeps the existing file's copy of it. */
      keepSection?: string;
    }
  | { path: typeof MCP_PATH; kind: 'mcp-entry'; entry: McpEntry };

export const DEFAULT_TARGET = 'http://localhost:3000';

const DEFAULT_MCP_BIN = fileURLToPath(new URL('../../../mcp/bin/poltergeist-mcp.js', import.meta.url));
const DEFAULT_TEMPLATES = fileURLToPath(new URL('../../../../integrations/kiro/', import.meta.url));
export const HOUSE_RULES = '## House rules';
const GENERIC_SPEC = 'the spec whose tasks just ran';

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

/** The files `init` writes into `opts.dir` (Req 10.3, D-41). Pure apart from reading the templates. */
export async function planInit(opts: InitOptions): Promise<PlannedFile[]> {
  const dir = resolve(opts.dir);
  const templates = opts.templatesDir ?? DEFAULT_TEMPLATES;
  const read = (rel: string) => readFile(join(templates, rel), 'utf8');

  const configPath = join(dir, 'poltergeist.config.json');
  const config = { target: opts.target ?? DEFAULT_TARGET, routes: [{ path: '/', auth: false }], concurrency: 12, reps: 3, forbidden: [] };
  parseConfig(config, { configPath, env: {} });

  // The MCP template is the one D-38 pins; fill in its two absolute paths.
  const template = JSON.parse(await read('mcp.json')).mcpServers.poltergeist as McpEntry;
  const args = [...template.args];
  args[0] = resolve(opts.mcpBin ?? DEFAULT_MCP_BIN);
  args[args.indexOf('--root') + 1] = dir;
  const entry: McpEntry = { command: template.command, args, env: { ...template.env }, autoApprove: [...template.autoApprove] };

  const files: PlannedFile[] = [
    { path: 'poltergeist.config.json', kind: 'text', content: json(config), scaffold: true },
    { path: MCP_PATH, kind: 'mcp-entry', entry },
    { path: '.kiro/steering/poltergeist.md', kind: 'text', content: await read('steering/poltergeist.md'), keepSection: HOUSE_RULES },
  ];
  if (opts.hook !== false) {
    const spec = opts.spec === undefined ? GENERIC_SPEC : `the spec in \`${opts.spec}\``;
    const hook = JSON.parse(await read('hooks/poltergeist-summon.json')) as { hooks: { action: { prompt: string } }[] };
    for (const h of hook.hooks) h.action.prompt = h.action.prompt.replaceAll('{{SPEC}}', spec);
    files.push({ path: '.kiro/hooks/poltergeist-summon.json', kind: 'text', content: json(hook) });
  }
  return files;
}

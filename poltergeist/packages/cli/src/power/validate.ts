import { isAbsolute } from 'node:path';

/** Bundle-relative path → file content. */
export type PowerFiles = Record<string, string>;

export const PLUGIN_SCHEMA = 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json';
export const MCP_SCHEMA = 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json';
/** Specific phrases only: broad ones ("test", "api") activate the Power on unrelated work (D-46). */
export const POWER_KEYWORDS = ['poltergeist', 'summon ghosts', 'haunting report', 'rehaunt', 'adversarial acceptance tests', 'haunt spec'] as const;
export const SKILL_PATH = 'skills/poltergeist/SKILL.md';
export const PLACEHOLDER_BIN = '/ABSOLUTE/PATH/TO/poltergeist/packages/mcp/bin/poltergeist-mcp.js';
/** Where `planPower` writes the checkout's absolute path into the skill. */
export const CHECKOUT_PLACEHOLDER = '{{CHECKOUT}}';
const BROAD_KEYWORDS = new Set(['test', 'tests', 'testing', 'api', 'data']);
const SERVER = 'poltergeist';
const MAX_TOOL_NAME = 64;
const MAX_SKILL_DESCRIPTION = 1024;

const PLUGIN_NAME = /^[a-z0-9](?:[a-z0-9.-]{0,62}[a-z0-9])?$/;
const BARE_COMMAND = /^[A-Za-z0-9._-]+$/;

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const nonEmpty = (v: unknown) => typeof v === 'string' && v.trim() !== '';

function parseJson(files: PowerFiles, path: string, problems: string[]): Json | undefined {
  const text = files[path];
  if (text === undefined) return void problems.push(`${path}: missing`);
  try {
    const value: unknown = JSON.parse(text);
    if (isObject(value)) return value;
    problems.push(`${path}: not a JSON object`);
  } catch (err) {
    problems.push(`${path}: invalid JSON (${err instanceof Error ? err.message : String(err)})`);
  }
  return undefined;
}

/** `key: value` lines of a leading `---` block; undefined when there is none. No YAML beyond that. */
function frontmatter(text: string): Record<string, string> | undefined {
  const m = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!m) return undefined;
  const out: Record<string, string> = {};
  for (const line of m[1]!.split(/\r?\n/)) {
    const kv = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (kv) out[kv[1]!] = kv[2]!.replace(/^(["'])(.*)\1$/, '$2');
  }
  return out;
}

function checkPlugin(plugin: Json, problems: string[]): string | undefined {
  if (plugin.$schema !== PLUGIN_SCHEMA) problems.push(`plugin.json: $schema must be ${PLUGIN_SCHEMA}`);
  const name = plugin.name;
  if (typeof name !== 'string' || !PLUGIN_NAME.test(name) || name.includes('--') || name.includes('..')) {
    problems.push('plugin.json: name must be 1-64 chars of a-z 0-9 . -, start and end alphanumeric, with no -- or ..');
  }
  for (const field of ['version', 'description'] as const) if (!nonEmpty(plugin[field])) problems.push(`plugin.json: ${field} is required`);
  if (!isObject(plugin.author) || !nonEmpty(plugin.author.name)) problems.push('plugin.json: author.name is required');
  const keywords = plugin.keywords;
  if (!Array.isArray(keywords) || keywords.length === 0 || !keywords.every(nonEmpty)) problems.push('plugin.json: keywords must be a non-empty list of strings');
  else {
    const broad = keywords.filter((k) => BROAD_KEYWORDS.has(String(k).toLowerCase()));
    if (broad.length) problems.push(`plugin.json: keywords too broad, they would activate on unrelated work: ${broad.join(', ')}`);
  }
  return typeof name === 'string' ? name : undefined;
}

function checkMcp(mcp: Json, problems: string[]): void {
  if (mcp.$schema !== MCP_SCHEMA) problems.push(`mcp.json: $schema must be ${MCP_SCHEMA}`);
  const servers = mcp.mcpServers;
  const s = isObject(servers) ? servers[SERVER] : undefined;
  if (!isObject(s)) return void problems.push(`mcp.json: mcpServers.${SERVER} is missing`);
  if (s.type !== 'stdio') problems.push(`mcp.json: ${SERVER}.type must be "stdio"`);
  if (typeof s.command !== 'string' || !BARE_COMMAND.test(s.command)) problems.push(`mcp.json: ${SERVER}.command must be one bare program name on PATH (such as node)`);
  const args = s.args;
  const bin = Array.isArray(args) ? args[0] : undefined;
  if (bin === PLACEHOLDER_BIN) problems.push(`mcp.json: ${SERVER}.args[0] is still the placeholder; run poltergeist power --out <dir>`);
  else if (typeof bin !== 'string' || !isAbsolute(bin) || !bin.endsWith('poltergeist-mcp.js')) problems.push(`mcp.json: ${SERVER}.args[0] must be the absolute path of poltergeist-mcp.js`);
  if (!Array.isArray(args) || args.length !== 2 || args[1] !== '--root-from-spec') problems.push(`mcp.json: ${SERVER}.args must be [<bin>, "--root-from-spec"]`);
  const env = isObject(s.env) ? s.env : {};
  for (const reserved of ['PLUGIN_ROOT', 'PLUGIN_DATA']) if (Object.hasOwn(env, reserved)) problems.push(`mcp.json: ${SERVER}.env must not set ${reserved}`);
  if (Object.hasOwn(s, 'autoApprove')) problems.push(`mcp.json: ${SERVER}.autoApprove is not part of the plugin format; Kiro asks before each call`);
}

function checkSkill(text: string | undefined, problems: string[]): void {
  if (text === undefined) return void problems.push(`${SKILL_PATH}: missing`);
  const fm = frontmatter(text);
  if (!fm) return void problems.push(`${SKILL_PATH}: needs a --- frontmatter block with name and description`);
  const folder = SKILL_PATH.split('/')[1];
  if (fm.name !== folder) problems.push(`${SKILL_PATH}: name must be "${folder}", its folder's name`);
  const description = fm.description ?? '';
  if (description.trim() === '' || description.length > MAX_SKILL_DESCRIPTION) problems.push(`${SKILL_PATH}: description must be 1-${MAX_SKILL_DESCRIPTION} chars`);
  if (text.includes(CHECKOUT_PLACEHOLDER)) problems.push(`${SKILL_PATH}: ${CHECKOUT_PLACEHOLDER} is still a placeholder; run poltergeist power --out <dir>`);
}

/**
 * Checks a Power bundle against the documented Agent Plugins rules (D-46, docs/kiro-notes.md).
 * Returns one message per problem; empty means valid. `tools` are the MCP tool names, checked
 * against Kiro's 64-char limit once namespaced as `power-<plugin>-<server>_<tool>`.
 */
export function validatePower(files: PowerFiles, opts: { tools?: readonly string[] } = {}): string[] {
  const problems: string[] = [];
  const plugin = parseJson(files, 'plugin.json', problems);
  const name = plugin ? checkPlugin(plugin, problems) : undefined;
  const mcp = parseJson(files, 'mcp.json', problems);
  if (mcp) checkMcp(mcp, problems);
  checkSkill(files[SKILL_PATH], problems);
  const prefix = `power-${name ?? SERVER}-${SERVER}_`;
  for (const tool of opts.tools ?? []) {
    if (prefix.length + tool.length > MAX_TOOL_NAME) problems.push(`tool ${tool}: ${prefix}${tool} is over ${MAX_TOOL_NAME} chars`);
  }
  return problems;
}

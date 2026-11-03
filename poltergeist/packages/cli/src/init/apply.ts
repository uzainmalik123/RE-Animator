import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { MCP_PATH, type PlannedFile } from './plan.js';

/** `kept`: the user's scaffold (the config) differs, and is never replaced. Not a skip. */
export type InitOutcome = 'created' | 'unchanged' | 'kept' | 'skipped' | 'overwritten';
export type InitResult = { dir: string; files: { path: string; outcome: InitOutcome }[] };

/** `init` can't write safely: a bad project dir, a symlink in the way, or an unreadable `mcp.json`. */
export class InitError extends Error {
  override name = 'InitError';
}

type Decision = { path: string; outcome: InitOutcome; content: string };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Every existing segment of `rel` below `dir` must be a real directory or file, never a symlink. */
async function existing(dir: string, rel: string): Promise<string | undefined> {
  const parts = rel.split('/');
  let abs = dir;
  for (const [i, part] of parts.entries()) {
    abs = join(abs, part);
    const stat = await lstat(abs).catch((err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') return undefined;
      throw err;
    });
    if (!stat) return undefined;
    const shown = parts.slice(0, i + 1).join('/');
    if (stat.isSymbolicLink()) throw new InitError(`${shown} is a symlink; refusing to write through it`);
    if (i < parts.length - 1 && !stat.isDirectory()) throw new InitError(`${shown} is not a directory`);
    if (i === parts.length - 1 && !stat.isFile()) throw new InitError(`${shown} is not a regular file`);
  }
  return readFile(abs, 'utf8');
}

/** `fresh` up to its `heading`, then `current`'s copy of that section when it has one. */
function withSection(fresh: string, current: string, heading: RegExp): string {
  const at = (s: string) => s.search(heading);
  const mine = at(current);
  const ours = at(fresh);
  return mine < 0 || ours < 0 ? fresh : fresh.slice(0, ours) + current.slice(mine);
}

async function decide(dir: string, file: PlannedFile, force: boolean): Promise<Decision> {
  const current = await existing(dir, file.path);
  if (file.kind === 'text') {
    if (current === undefined) return { path: file.path, outcome: 'created', content: file.content };
    const content = file.keepSection ? withSection(file.content, current, file.keepSection) : file.content;
    if (current === content) return { path: file.path, outcome: 'unchanged', content: current };
    if (file.scaffold) return { path: file.path, outcome: 'kept', content: current };
    return { path: file.path, outcome: force ? 'overwritten' : 'skipped', content };
  }

  // mcp.json is shared with the user's other servers: merge one entry, never replace the file.
  let doc: Record<string, unknown> = {};
  if (current !== undefined) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(current);
    } catch {
      throw new InitError(`${MCP_PATH} is not valid JSON; fix it by hand, init never rewrites it`);
    }
    if (!isObject(parsed) || (parsed.mcpServers !== undefined && !isObject(parsed.mcpServers))) {
      throw new InitError(`${MCP_PATH} must be an object whose "mcpServers" is an object`);
    }
    doc = parsed;
  }
  const servers = (doc.mcpServers ?? {}) as Record<string, unknown>;
  const write = (outcome: InitOutcome): Decision => ({
    path: file.path,
    outcome,
    content: `${JSON.stringify({ ...doc, mcpServers: { ...servers, poltergeist: file.entry } }, null, 2)}\n`,
  });
  if (!Object.hasOwn(servers, 'poltergeist')) return write('created');
  if (isDeepStrictEqual(servers.poltergeist, file.entry)) return { path: file.path, outcome: 'unchanged', content: current! };
  return force ? write('overwritten') : { path: file.path, outcome: 'skipped', content: current! };
}

/** Decides every file first, so a refusal writes nothing; then writes the created and overwritten ones (Req 10.3). */
export async function applyInit(dir: string, files: PlannedFile[], force: boolean): Promise<InitResult> {
  const stat = await lstat(dir).catch(() => undefined);
  if (!stat?.isDirectory()) throw new InitError(`${dir} is not a directory`);

  const decisions: Decision[] = [];
  for (const file of files) decisions.push(await decide(dir, file, force));
  for (const d of decisions) {
    if (d.outcome !== 'created' && d.outcome !== 'overwritten') continue;
    const abs = join(dir, d.path);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, d.content);
  }
  return { dir, files: decisions.map(({ path, outcome }) => ({ path, outcome })) };
}

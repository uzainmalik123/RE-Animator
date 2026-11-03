import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeClaimsProject, type ClaimsProject } from '../../core/test/summon/project-fixture.js';
import { MCP_TOOLS, validatePower } from '../src/power/index.js';

// F18 Done-when (fixture, D-46): `poltergeist power` writes a valid Power whose server, started
// exactly as the bundle says from the plugin folder, serves any project by absolute spec path.
// Installing it in Kiro and running the F11 loop through it is KI-65.
const BIN = fileURLToPath(new URL('../bin/poltergeist.js', import.meta.url));
const PATHS = ['mcp.json', 'plugin.json', 'skills/poltergeist/SKILL.md'];

function run(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(process.execPath, [BIN, ...args], { env: { ...process.env, NO_COLOR: '1' } }, (err, stdout, stderr) => {
      resolve({ code: err ? ((err as { code?: number }).code ?? 1) : 0, stdout, stderr });
    });
  });
}

let tmp: string;
let project: ClaimsProject;
beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'power-done-'));
  project = await makeClaimsProject();
});
afterAll(async () => {
  await rm(tmp, { recursive: true, force: true });
  await project?.close();
});

describe('poltergeist power (Done-when)', () => {
  it('builds a Power whose server serves a project by absolute spec path', async () => {
    const out = join(tmp, 'power');
    const built = await run(['power', '--out', out]);
    expect(built.code, built.stderr).toBe(0);
    for (const p of PATHS) expect(built.stdout).toMatch(new RegExp(`created\\s+${p.replace(/\./g, '\\.')}`));
    expect(built.stdout).toContain('Import power from a folder');

    const files = Object.fromEntries(await Promise.all(PATHS.map(async (p) => [p, await readFile(join(out, p), 'utf8')] as const)));
    expect(validatePower(files, { tools: MCP_TOOLS })).toEqual([]);

    const server = JSON.parse(files['mcp.json']!).mcpServers.poltergeist as { command: string; args: string[] };
    // Kiro runs a plugin server with the plugin folder as its cwd.
    const transport = new StdioClientTransport({ command: server.command, args: server.args, cwd: out, stderr: 'pipe' });
    const client = new Client({ name: 'kiro-like', version: '0' });
    await client.connect(transport);
    try {
      const { tools } = await client.listTools();
      expect(tools.map((t) => t.name).sort()).toEqual([...MCP_TOOLS].sort());

      const call = async (args: Record<string, unknown>) =>
        (await client.callTool({ name: 'list_criteria', arguments: args })) as { isError?: boolean; content: { text: string }[] };
      const listed = await call({ specDir: project.specDir });
      expect(listed.isError ?? false, listed.content[0]!.text).toBe(false);
      expect(JSON.parse(listed.content[0]!.text).criteria.map((c: { id: string }) => c.id)).toEqual(['3.1', '3.2']);

      const rel = await call({ specDir: relative(project.root, project.specDir) });
      expect(rel.isError).toBe(true);
      expect(rel.content[0]!.text).toMatch(/absolute/);
    } finally {
      await client.close();
    }
  }, 60_000);

  it('refuses a non-empty --out with exit 2', async () => {
    const again = await run(['power', '--out', join(tmp, 'power')]);
    expect(again.code).toBe(2);
    expect(again.stderr).toMatch(/not empty/);
  }, 30_000);
});

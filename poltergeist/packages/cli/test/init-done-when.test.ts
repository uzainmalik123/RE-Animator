import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// F13 Done-when (fixture, D-41): init wires a fresh project so Kiro's MCP entry works with no manual
// setup. The real Kiro hook trigger is KI-51.
const BIN = fileURLToPath(new URL('../bin/poltergeist.js', import.meta.url));
const PATHS = ['poltergeist.config.json', '.kiro/settings/mcp.json', '.kiro/steering/poltergeist.md', '.kiro/hooks/poltergeist-summon.json'];

function run(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(process.execPath, [BIN, ...args], { env: { ...process.env, NO_COLOR: '1' } }, (err, stdout, stderr) => {
      resolve({ code: err ? ((err as { code?: number }).code ?? 1) : 0, stdout, stderr });
    });
  });
}

let dir: string;
let other: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'init-done-'));
  other = await mkdtemp(join(tmpdir(), 'init-done-remote-'));
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
  await rm(other, { recursive: true, force: true });
});

describe('poltergeist init (Done-when)', () => {
  it('creates, then is idempotent, then skips and forces', async () => {
    const first = await run(['init', '--dir', dir]);
    expect(first.code).toBe(0);
    for (const p of PATHS) expect(first.stdout).toMatch(new RegExp(`created\\s+${p.replace(/\./g, '\\.')}`));

    const second = await run(['init', '--dir', dir]);
    expect(second.code).toBe(0);
    for (const p of PATHS) expect(second.stdout).toMatch(new RegExp(`unchanged\\s+${p.replace(/\./g, '\\.')}`));

    await writeFile(join(dir, '.kiro/steering/poltergeist.md'), 'mine\n');
    const third = await run(['init', '--dir', dir]);
    expect(third.code).toBe(1);
    expect(third.stdout).toMatch(/skipped\s+\.kiro\/steering\/poltergeist\.md/);
    expect(third.stdout).toContain('--force would replace: .kiro/steering/poltergeist.md');

    const forced = await run(['init', '--dir', dir, '--force']);
    expect(forced.code).toBe(0);
    expect(forced.stdout).toMatch(/overwritten\s+\.kiro\/steering\/poltergeist\.md/);
  }, 60_000);

  it('refuses a non-loopback target with exit 2', async () => {
    const r = await run(['init', '--dir', other, '--target', 'https://example.com']);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('not allowlisted');
  }, 30_000);

  it('the written MCP entry starts the server with no manual setup', async () => {
    const entry = JSON.parse(await readFile(join(dir, '.kiro/settings/mcp.json'), 'utf8')).mcpServers.poltergeist;
    const transport = new StdioClientTransport({ command: entry.command, args: entry.args, stderr: 'pipe' });
    const client = new Client({ name: 'init-done-when', version: '0' });
    await client.connect(transport);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(['get_haunting_report', 'get_run_status', 'list_criteria', 'rehaunt', 'summon_ghosts']);
    await client.close();
  }, 30_000);

  it('writes a hook in the documented v1 shape', async () => {
    const hook = JSON.parse(await readFile(join(dir, '.kiro/hooks/poltergeist-summon.json'), 'utf8'));
    expect(hook.version).toBe('v1');
    expect(hook.hooks).toHaveLength(1);
    expect(hook.hooks[0]).toMatchObject({ name: expect.any(String), trigger: 'PostTaskExecution', action: { type: 'agent', prompt: expect.any(String) } });
  });
});

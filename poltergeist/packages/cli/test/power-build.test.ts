import { existsSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildPower, planPower, PowerError } from '../src/power/index.js';

const PATHS = ['mcp.json', 'plugin.json', 'skills/poltergeist/SKILL.md'];
const TEMPLATES = fileURLToPath(new URL('../../../integrations/kiro/power/', import.meta.url));

let tmp: string;
beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'power-'));
});
afterEach(() => rm(tmp, { recursive: true, force: true }));

describe('planPower', () => {
  it('fills the bin path and keeps the rest', async () => {
    const files = await planPower({ mcpBin: '/x/poltergeist-mcp.js' });
    expect(Object.keys(files).sort()).toEqual(PATHS);
    const server = JSON.parse(files['mcp.json']!).mcpServers.poltergeist;
    expect(server.args).toEqual(['/x/poltergeist-mcp.js', '--root-from-spec']);
    expect(files['plugin.json']).toBe(await readFile(join(TEMPLATES, 'plugin.json'), 'utf8'));
  });

  it("defaults to this checkout's server bin", async () => {
    const files = await planPower({});
    const bin = JSON.parse(files['mcp.json']!).mcpServers.poltergeist.args[0] as string;
    expect(bin).toMatch(/packages\/mcp\/bin\/poltergeist-mcp\.js$/);
    expect(existsSync(bin)).toBe(true);
  });

  it('refuses templates that break the format', async () => {
    const bad = join(tmp, 'templates');
    await cp(TEMPLATES, bad, { recursive: true });
    const plugin = JSON.parse(await readFile(join(bad, 'plugin.json'), 'utf8'));
    await writeFile(join(bad, 'plugin.json'), JSON.stringify({ ...plugin, name: 'Bad Name' }));
    await expect(planPower({ templatesDir: bad })).rejects.toThrow(/plugin\.json: name/);
    await expect(planPower({ templatesDir: bad })).rejects.toBeInstanceOf(PowerError);
  });
});

describe('buildPower', () => {
  it('writes the planned bundle into a new folder', async () => {
    const out = join(tmp, 'power');
    const result = await buildPower({ out, mcpBin: '/x/poltergeist-mcp.js' });
    expect(result).toEqual({ out, files: PATHS });
    const plan = await planPower({ mcpBin: '/x/poltergeist-mcp.js' });
    for (const p of PATHS) expect(await readFile(join(out, p), 'utf8')).toBe(plan[p]);
  });

  it('writes into an existing empty folder', async () => {
    const out = join(tmp, 'empty');
    await mkdir(out);
    await expect(buildPower({ out })).resolves.toMatchObject({ files: PATHS });
  });

  it('refuses a non-empty folder and writes nothing', async () => {
    const out = join(tmp, 'full');
    await mkdir(out);
    await writeFile(join(out, 'keep.txt'), 'x');
    await expect(buildPower({ out })).rejects.toThrow(/not empty/);
    expect(await readdir(out)).toEqual(['keep.txt']);
  });

  it('refuses a file', async () => {
    const out = join(tmp, 'file');
    await writeFile(out, 'x');
    await expect(buildPower({ out })).rejects.toBeInstanceOf(PowerError);
    expect(await readFile(out, 'utf8')).toBe('x');
  });

  it('writes nothing when the templates are bad', async () => {
    const bad = join(tmp, 'templates');
    await cp(TEMPLATES, bad, { recursive: true });
    await writeFile(join(bad, 'mcp.json'), '{}');
    const out = join(tmp, 'power');
    await expect(buildPower({ out, templatesDir: bad })).rejects.toBeInstanceOf(PowerError);
    expect(existsSync(out)).toBe(false);
  });
});

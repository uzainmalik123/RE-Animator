import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigError } from '@poltergeist/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { init, InitError } from '../src/init/index.js';

const PATHS = ['poltergeist.config.json', '.kiro/settings/mcp.json', '.kiro/steering/poltergeist.md', '.kiro/hooks/poltergeist-summon.json'];
const STEERING = '.kiro/steering/poltergeist.md';
const MCP = '.kiro/settings/mcp.json';

let dir: string;
let outside: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'init-apply-'));
  outside = await mkdtemp(join(tmpdir(), 'init-outside-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
  await rm(outside, { recursive: true, force: true });
});

const outcomes = (r: Awaited<ReturnType<typeof init>>) => Object.fromEntries(r.files.map((f) => [f.path, f.outcome]));
const readAll = async () => Promise.all(PATHS.map((p) => readFile(join(dir, p), 'utf8')));
const put = async (rel: string, content: string) => {
  await mkdir(join(dir, rel, '..'), { recursive: true });
  await writeFile(join(dir, rel), content);
};

describe('init', () => {
  it('creates all four files, then leaves them unchanged on a second run', async () => {
    const first = await init({ dir });
    expect(first.files.map((f) => f.path)).toEqual(PATHS);
    expect(new Set(first.files.map((f) => f.outcome))).toEqual(new Set(['created']));
    const before = await readAll();
    const second = await init({ dir });
    expect(new Set(second.files.map((f) => f.outcome))).toEqual(new Set(['unchanged']));
    expect(await readAll()).toEqual(before);
  });

  it('skips a file that differs, and overwrites it with force', async () => {
    await init({ dir });
    await writeFile(join(dir, STEERING), 'mine\n');
    expect(outcomes(await init({ dir }))[STEERING]).toBe('skipped');
    expect(await readFile(join(dir, STEERING), 'utf8')).toBe('mine\n');
    expect(outcomes(await init({ dir, force: true }))[STEERING]).toBe('overwritten');
    expect(await readFile(join(dir, STEERING), 'utf8')).toContain('# Poltergeist');
  });

  it('keeps an edited config, even with force: it is the user\'s, not ours', async () => {
    await init({ dir });
    const mine = '{"target":"http://localhost:3000","routes":[{"path":"/shop","auth":false}]}\n';
    await writeFile(join(dir, 'poltergeist.config.json'), mine);
    for (const force of [false, true]) {
      expect(outcomes(await init({ dir, force }))['poltergeist.config.json']).toBe('kept');
      expect(await readFile(join(dir, 'poltergeist.config.json'), 'utf8')).toBe(mine);
    }
  });

  it('carries House rules over whatever the heading case, as summon reads them (F17 review I1)', async () => {
    await init({ dir });
    const original = await readFile(join(dir, STEERING), 'utf8');
    const rules = '## House Rules  \n\n- forbid: DELETE /api/admin*\n';
    await writeFile(join(dir, STEERING), `stale intro\n\n${rules}`);
    await init({ dir, force: true });
    expect(await readFile(join(dir, STEERING), 'utf8')).toBe(original.slice(0, original.indexOf('## House rules')) + rules);
  });

  it('carries the House rules over when force replaces the steering file', async () => {
    await init({ dir });
    const original = await readFile(join(dir, STEERING), 'utf8');
    const rules = '## House rules\n\n- never test /admin\n';
    await writeFile(join(dir, STEERING), `stale intro\n\n${rules}`);
    expect(outcomes(await init({ dir, force: true }))[STEERING]).toBe('overwritten');
    const now = await readFile(join(dir, STEERING), 'utf8');
    expect(now).toBe(original.slice(0, original.indexOf('## House rules')) + rules);
    expect(outcomes(await init({ dir }))[STEERING]).toBe('unchanged');
  });

  it('keeps other servers and top-level keys in mcp.json', async () => {
    const other = { command: 'x', args: ['--y'] };
    await put(MCP, JSON.stringify({ mcpServers: { other }, extra: 1 }));
    expect(outcomes(await init({ dir }))[MCP]).toBe('created');
    const merged = JSON.parse(await readFile(join(dir, MCP), 'utf8'));
    expect(merged.mcpServers.other).toEqual(other);
    expect(merged.extra).toBe(1);
    expect(merged.mcpServers.poltergeist.command).toBe('node');

    expect(outcomes(await init({ dir }))[MCP]).toBe('unchanged');
    merged.mcpServers.poltergeist.autoApprove = [];
    await writeFile(join(dir, MCP), JSON.stringify(merged));
    expect(outcomes(await init({ dir }))[MCP]).toBe('skipped');
    expect(outcomes(await init({ dir, force: true }))[MCP]).toBe('overwritten');
    const forced = JSON.parse(await readFile(join(dir, MCP), 'utf8'));
    expect(forced.mcpServers.other).toEqual(other);
    expect(forced.mcpServers.poltergeist.autoApprove).toHaveLength(3);
  });

  it('refuses invalid mcp.json, even with force, before writing anything', async () => {
    for (const bad of ['{oops', '[]', '{"mcpServers":[]}']) {
      await put(MCP, bad);
      for (const force of [false, true]) {
        await expect(init({ dir, force })).rejects.toBeInstanceOf(InitError);
        expect(await readFile(join(dir, MCP), 'utf8')).toBe(bad);
        expect(await readdir(dir)).toEqual(['.kiro']);
        expect(await readdir(join(dir, '.kiro'))).toEqual(['settings']);
      }
    }
  });

  it('refuses symlinks: a linked .kiro or a linked file', async () => {
    await symlink(outside, join(dir, '.kiro'));
    await expect(init({ dir, force: true })).rejects.toThrow(/\.kiro.*symlink/);
    expect(await readdir(outside)).toEqual([]);
    await rm(join(dir, '.kiro'));

    await mkdir(join(dir, '.kiro/steering'), { recursive: true });
    await writeFile(join(outside, 'target.md'), 'outside\n');
    await symlink(join(outside, 'target.md'), join(dir, STEERING));
    await expect(init({ dir, force: true })).rejects.toBeInstanceOf(InitError);
    expect(await readFile(join(outside, 'target.md'), 'utf8')).toBe('outside\n');
    expect(await readdir(dir)).toEqual(['.kiro']);
  });

  it('rejects a non-loopback target before writing', async () => {
    await expect(init({ dir, target: 'https://example.com' })).rejects.toBeInstanceOf(ConfigError);
    expect(await readdir(dir)).toEqual([]);
  });

  it('never touches the spec files (D-14)', async () => {
    const req = '.kiro/specs/x/requirements.md';
    await put(req, '# Requirements\n');
    await init({ dir, force: true });
    expect(await readFile(join(dir, req), 'utf8')).toBe('# Requirements\n');
  });

  it('rejects a dir that does not exist or is a file', async () => {
    await expect(init({ dir: join(dir, 'nope') })).rejects.toBeInstanceOf(InitError);
    await writeFile(join(dir, 'f'), '');
    await expect(init({ dir: join(dir, 'f') })).rejects.toBeInstanceOf(InitError);
  });
});

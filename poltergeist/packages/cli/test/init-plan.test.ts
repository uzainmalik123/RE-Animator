import { resolve } from 'node:path';
import { ConfigError, parseConfig } from '@poltergeist/core';
import { describe, expect, it } from 'vitest';
import { DEFAULT_TARGET, planInit, type PlannedFile } from '../src/init/plan.js';

const PATHS = ['poltergeist.config.json', '.kiro/settings/mcp.json', '.kiro/steering/poltergeist.md', '.kiro/hooks/poltergeist-summon.json'];
const text = (files: PlannedFile[], path: string) => {
  const f = files.find((x) => x.path === path);
  if (f?.kind !== 'text') throw new Error(`no text file ${path}`);
  return f.content;
};
const mcpEntry = (files: PlannedFile[]) => {
  const f = files.find((x) => x.kind === 'mcp-entry');
  if (f?.kind !== 'mcp-entry') throw new Error('no mcp entry');
  return f.entry;
};
// D-09: theme words stay out of agent-facing text; tool and file names are literal identifiers.
const themeFree = (s: string) =>
  s.replace(/summon_ghosts|get_haunting_report|rehaunt|haunting-report\.md|poltergeist-summon\.json/g, '');

describe('planInit', () => {
  it('plans the four files in order, with absolute paths with spaces kept verbatim', async () => {
    const files = await planInit({ dir: '/p a/app' });
    expect(files.map((f) => f.path)).toEqual(PATHS);
    const entry = mcpEntry(files);
    expect(entry.command).toBe('node');
    expect(entry.args).toHaveLength(3);
    expect(entry.args[0]).toMatch(/packages\/mcp\/bin\/poltergeist-mcp\.js$/);
    expect(entry.args[0]!.startsWith('/')).toBe(true);
    expect(entry.args.slice(1)).toEqual(['--root', '/p a/app']);
    expect(entry.env).toEqual({ ANTHROPIC_API_KEY: '${ANTHROPIC_API_KEY}' });
    expect([...entry.autoApprove].sort()).toEqual(['get_haunting_report', 'get_run_status', 'list_criteria']);
  });

  it('scaffolds a config that passes parseConfig', async () => {
    const content = text(await planInit({ dir: '/p/app' }), 'poltergeist.config.json');
    expect(content.endsWith('\n')).toBe(true);
    const { config } = parseConfig(JSON.parse(content), { configPath: '/p/app/poltergeist.config.json', env: {} });
    expect(config.target).toBe(DEFAULT_TARGET);
    expect(DEFAULT_TARGET).toBe('http://localhost:3000');
    expect(config.routes).toEqual([{ path: '/', auth: false }]);
    expect(config.concurrency).toBe(12);
    expect(config.reps).toBe(3);
  });

  it('uses --target and rejects a non-loopback one', async () => {
    const content = text(await planInit({ dir: '/p/app', target: 'http://127.0.0.1:5173' }), 'poltergeist.config.json');
    expect(JSON.parse(content).target).toBe('http://127.0.0.1:5173');
    await expect(planInit({ dir: '/p/app', target: 'https://example.com' })).rejects.toBeInstanceOf(ConfigError);
  });

  it('writes a v1 PostTaskExecution agent hook, naming the spec when given', async () => {
    const generic = JSON.parse(text(await planInit({ dir: '/p/app' }), '.kiro/hooks/poltergeist-summon.json'));
    expect(generic.version).toBe('v1');
    expect(generic.hooks).toHaveLength(1);
    const [hook] = generic.hooks;
    expect(hook.trigger).toBe('PostTaskExecution');
    expect(hook.action.type).toBe('agent');
    expect(hook.action.prompt).not.toContain('{{');
    expect(hook.action.prompt).toContain('the spec whose tasks just ran');
    const named = JSON.parse(text(await planInit({ dir: '/p/app', spec: '.kiro/specs/shop' }), '.kiro/hooks/poltergeist-summon.json'));
    expect(named.hooks[0].action.prompt).toContain('`.kiro/specs/shop`');
  });

  it('omits the hook with hook: false', async () => {
    expect((await planInit({ dir: '/p/app', hook: false })).map((f) => f.path)).toEqual(PATHS.slice(0, 3));
  });

  it('keeps theme words out of the steering and hook text (D-09)', async () => {
    const files = await planInit({ dir: '/p/app' });
    for (const path of ['.kiro/steering/poltergeist.md', '.kiro/hooks/poltergeist-summon.json']) {
      expect(themeFree(text(files, path))).not.toMatch(/ghost|haunt|summon|spirit|possess/i);
    }
  });

  it('resolves a relative dir against cwd', async () => {
    const entry = mcpEntry(await planInit({ dir: 'rel/app' }));
    expect(entry.args[2]).toBe(resolve('rel/app'));
  });
});

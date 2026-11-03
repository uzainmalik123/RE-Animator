import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { POWER_KEYWORDS, validatePower, type PowerFiles } from '../src/power/validate.js';

const TEMPLATES = new URL('../../../integrations/kiro/power/', import.meta.url);
const PLACEHOLDER = '/ABSOLUTE/PATH/TO/poltergeist/packages/mcp/bin/poltergeist-mcp.js';
const TOOLS = ['list_criteria', 'summon_ghosts', 'get_run_status', 'get_haunting_report', 'rehaunt'];
const PATHS = ['plugin.json', 'mcp.json', 'skills/poltergeist/SKILL.md'];

const templates = (): PowerFiles => Object.fromEntries(PATHS.map((p) => [p, readFileSync(new URL(p, TEMPLATES), 'utf8')]));
const good = (): PowerFiles => {
  const files = templates();
  files['mcp.json'] = files['mcp.json']!.replace(PLACEHOLDER, '/abs/poltergeist-mcp.js');
  return files;
};
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const edit = (path: 'plugin.json' | 'mcp.json', fn: (j: Json) => void): PowerFiles => {
  const files = good();
  const j = JSON.parse(files[path]!) as Json;
  fn(j);
  files[path] = JSON.stringify(j);
  return files;
};
const server = (j: Json) => j.mcpServers.poltergeist as Json;

describe('validatePower', () => {
  it('accepts the filled templates', () => {
    expect(validatePower(good(), { tools: TOOLS })).toEqual([]);
  });

  it('reports only the placeholder bin in the committed templates', () => {
    const problems = validatePower(templates(), { tools: TOOLS });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/mcp\.json.*placeholder/);
  });

  it('reports a missing file', () => {
    const files = good();
    delete files['plugin.json'];
    expect(validatePower(files).join('\n')).toMatch(/plugin\.json/);
  });

  it.each<[string, (j: Json) => void]>([
    ['wrong $schema', (j) => (j.$schema = 'https://example.com/x.json')],
    ['upper-case name', (j) => (j.name = 'Poltergeist')],
    ['double dash name', (j) => (j.name = 'polter--geist')],
    ['leading dash name', (j) => (j.name = '-pg')],
    ['no version', (j) => delete j.version],
    ['no description', (j) => delete j.description],
    ['no author name', (j) => (j.author = {})],
    ['no keywords', (j) => delete j.keywords],
    ['a broad keyword', (j) => j.keywords.push('test')],
  ])('plugin.json: %s', (_, fn) => {
    expect(validatePower(edit('plugin.json', fn))).toHaveLength(1);
  });

  it.each<[string, (j: Json) => void]>([
    ['wrong $schema', (j) => (j.$schema = 'x')],
    ['no stdio type', (j) => delete server(j).type],
    ['absolute command', (j) => (server(j).command = '/usr/bin/node')],
    ['command with a space', (j) => (server(j).command = 'node --x')],
    ['relative bin', (j) => (server(j).args[0] = 'packages/mcp/bin/poltergeist-mcp.js')],
    ['no --root-from-spec', (j) => (server(j).args = [server(j).args[0]])],
    ['reserved env key', (j) => (server(j).env.PLUGIN_ROOT = 'x')],
    ['autoApprove', (j) => (server(j).autoApprove = ['list_criteria'])],
  ])('mcp.json: %s', (_, fn) => {
    expect(validatePower(edit('mcp.json', fn))).toHaveLength(1);
  });

  it('checks the skill frontmatter', () => {
    const files = good();
    const skill = files['skills/poltergeist/SKILL.md']!;
    expect(validatePower({ ...files, 'skills/poltergeist/SKILL.md': skill.replace(/^name: .*$/m, 'name: ghosts') })).toHaveLength(1);
    expect(validatePower({ ...files, 'skills/poltergeist/SKILL.md': skill.replace(/^description: .*$/m, `description: ${'a'.repeat(1025)}`) })).toHaveLength(1);
    expect(validatePower({ ...files, 'skills/poltergeist/SKILL.md': 'no frontmatter' })).toHaveLength(1);
  });

  it('checks the namespaced tool names fit in 64 chars', () => {
    const long = 'x'.repeat(64 - 'power-poltergeist-poltergeist_'.length + 1);
    expect(validatePower(good(), { tools: [long] })).toHaveLength(1);
    expect(validatePower(good(), { tools: [long.slice(1)] })).toEqual([]);
  });

  it('keeps the keywords specific', () => {
    expect(JSON.parse(good()['plugin.json']!).keywords).toEqual([...POWER_KEYWORDS]);
  });

  it('teaches the loop in the skill', () => {
    const skill = good()['skills/poltergeist/SKILL.md']!;
    for (const tool of TOOLS) expect(skill).toContain(tool);
    for (const word of ['absolute', 'poltergeist init', 'requirements.md']) expect(skill).toContain(word);
  });
});

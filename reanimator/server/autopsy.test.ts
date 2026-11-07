import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LIMITS } from '../shared/autopsy.js';
import { buildAutopsy } from './autopsy.js';

const made: string[] = [];
afterEach(async () => {
  await Promise.all(made.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

type Tree = Record<string, string | Buffer>;
async function tree(files: Tree): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'autopsy-'));
  made.push(dir);
  for (const [rel, body] of Object.entries(files)) {
    await mkdir(dirname(join(dir, rel)), { recursive: true });
    await writeFile(join(dir, rel), body);
  }
  return dir;
}
const pkg = (o: object) => JSON.stringify(o, null, 2) + '\n';

describe('buildAutopsy: known deaths', () => {
  it('an engines pin and a dropped engine-strict .npmrc are engine-pin causes; seen needs EBADENGINE', async () => {
    const corpse = await tree({ 'package.json': pkg({ name: 'g', engines: { node: '0.10.x' } }), '.npmrc': 'engine-strict=true\n' });
    const revived = await tree({ 'package.json': pkg({ name: 'g', engines: { node: '>=22' } }), '.npmrc': '' });
    const a = await buildAutopsy(corpse, revived, { vital: 'install', detail: 'npm error code EBADENGINE\nnpm error engine Unsupported' });
    expect(a.diedAt).toBe('install');
    expect(a.symptom).toBe('npm error code EBADENGINE');
    expect(a.causes.map((c) => [c.kind, c.file, c.seen])).toEqual([
      ['engine-pin', '.npmrc', true],
      ['engine-pin', 'package.json', true],
    ]);
    const field = a.causes.find((c) => c.file === 'package.json')!;
    expect(field.lines.filter((l) => l.op === '-').map((l) => l.text).join()).toContain('0.10.x');
    expect(field.lines.filter((l) => l.op === '+').map((l) => l.text).join()).toContain('>=22');
  });

  it('a removed util.print is a removed-api cause named for it, seen when the output names it', async () => {
    const corpse = await tree({ 'build.js': "var util = require('util');\nutil.print('built');\n" });
    const revived = await tree({ 'build.js': "process.stdout.write('built');\n" });
    const a = await buildAutopsy(corpse, revived, { vital: 'build', detail: '> build\nTypeError: util.print is not a function' });
    expect(a.symptom).toBe('TypeError: util.print is not a function');
    expect(a.causes).toHaveLength(1);
    expect(a.causes[0]).toMatchObject({ kind: 'removed-api', title: 'Removed Node API: util.print', file: 'build.js', seen: true });
  });

  it('process.EventEmitter is removed-api; a cause the output never named is not seen', async () => {
    const corpse = await tree({ 'server.js': 'var t = new process.EventEmitter();\n' });
    const revived = await tree({ 'server.js': "var t = new (require('events').EventEmitter)();\n" });
    const a = await buildAutopsy(corpse, revived, { vital: 'install', detail: 'npm error code EBADENGINE' });
    expect(a.causes[0]).toMatchObject({ kind: 'removed-api', title: 'Removed Node API: process.EventEmitter', seen: false });
  });

  it('several removed APIs in one file are one cause that names them all', async () => {
    const corpse = await tree({ 'a.js': 'util.puts(1);\nsys.puts(2);\nos.tmpDir();\n' });
    const revived = await tree({ 'a.js': 'console.log(1);\nconsole.log(2);\nos.tmpdir();\n' });
    const a = await buildAutopsy(corpse, revived, null);
    expect(a.causes).toHaveLength(1);
    expect(a.causes[0]!.title).toBe('Removed Node APIs: util.puts, sys.puts, os.tmpDir');
  });

  it('a deprecated-but-present API (process.binding) is not called removed', async () => {
    const corpse = await tree({ 'a.js': "process.binding('fs');\n" });
    const revived = await tree({ 'a.js': "require('fs');\n" });
    const a = await buildAutopsy(corpse, revived, null);
    expect(a.causes[0]!.kind).toBe('other');
  });

  it('node-sass leaving the dependencies is a node-sass cause, compared by package', async () => {
    const corpse = await tree({ 'package.json': pkg({ name: 'x', dependencies: { 'node-sass': '^3.0.0', left: '1.0.0' } }) });
    const revived = await tree({ 'package.json': pkg({ name: 'x', dependencies: { sass: '^1.77.0', left: '1.0.0' } }) });
    const a = await buildAutopsy(corpse, revived, { vital: 'install', detail: 'gyp ERR! node-gyp rebuild' });
    expect(a.causes).toHaveLength(1);
    expect(a.causes[0]).toMatchObject({ kind: 'node-sass', file: 'package.json', seen: true });
    const text = a.causes[0]!.lines.map((l) => l.op + l.text).join('\n');
    expect(text).toContain('-"node-sass": "^3.0.0"');
    expect(text).toContain('+"sass": "^1.77.0"');
    expect(text).not.toContain('left');
  });

  it('an added openssl-legacy-provider line is openssl; a deleted lockfile is lockfile with no dumped lines', async () => {
    const corpse = await tree({ 'package-lock.json': '{"lockfileVersion":1}' });
    const revived = await tree({ '.npmrc': 'node-options=--openssl-legacy-provider\nlegacy-peer-deps=true\n' });
    const a = await buildAutopsy(corpse, revived, null);
    expect(a.causes.map((c) => [c.kind, c.file])).toEqual([
      ['openssl', '.npmrc'],
      ['lockfile', 'package-lock.json'],
    ]);
    expect(a.causes[1]!.lines).toEqual([]);
  });

  it('an unrelated edit is shown as other and never seen', async () => {
    const corpse = await tree({ 'README.md': 'old\n' });
    const revived = await tree({ 'README.md': 'new\n' });
    const a = await buildAutopsy(corpse, revived, { vital: 'serve', detail: 'README old' });
    expect(a.causes[0]).toMatchObject({ kind: 'other', file: 'README.md', seen: false });
  });

  it('a malformed package.json falls back to a plain diff instead of throwing', async () => {
    const corpse = await tree({ 'package.json': '{ not json' });
    const revived = await tree({ 'package.json': '{ still not' });
    const a = await buildAutopsy(corpse, revived, null);
    expect(a.causes[0]).toMatchObject({ kind: 'other', file: 'package.json' });
    expect(a.causes[0]!.lines.length).toBeGreaterThan(0);
  });
});

describe('buildAutopsy: shape and limits', () => {
  it('nothing changed: no causes, the vital and symptom still set; no failure: diedAt null', async () => {
    const t = { 'a.js': 'same\n' };
    const a = await buildAutopsy(await tree(t), await tree(t), { vital: 'serve', detail: '\n  boom  \nmore' });
    expect(a).toEqual({ diedAt: 'serve', symptom: 'boom', causes: [], skipped: 0 });
    expect((await buildAutopsy(await tree(t), await tree(t), null)).diedAt).toBeNull();
  });

  it('skips symlinks (never read), node_modules, binary and oversized files, and counts them', async () => {
    const corpse = await tree({ 'node_modules/x/i.js': 'a', 'bin.dat': Buffer.from([1, 0, 2]), 'big.txt': 'a'.repeat(LIMITS.fileBytes + 1) });
    await symlink('/etc/hostname', join(corpse, 'link.js'));
    const revived = await tree({ 'node_modules/x/i.js': 'b', 'bin.dat': Buffer.from([3, 0, 4]), 'big.txt': 'b'.repeat(LIMITS.fileBytes + 1), 'link.js': 'plain\n' });
    const a = await buildAutopsy(corpse, revived, null);
    expect(a.causes).toEqual([]);
    expect(a.skipped).toBe(3);
  });

  it('caps evidence at 40 lines of 200 chars and says it truncated', async () => {
    const corpse = await tree({ 'a.txt': 'start\n' });
    const body = Array.from({ length: 100 }, (_, i) => `line ${i} ${'x'.repeat(300)}`).join('\n');
    const revived = await tree({ 'a.txt': body });
    const c = (await buildAutopsy(corpse, revived, null)).causes[0]!;
    expect(c.lines).toHaveLength(LIMITS.lines);
    expect(Math.max(...c.lines.map((l) => l.text.length))).toBeLessThanOrEqual(LIMITS.lineChars);
    expect(c.truncated).toBe(true);
  });

  it('keeps 12 causes and counts the rest as skipped', async () => {
    const corpse: Tree = {};
    const revived: Tree = {};
    for (let i = 0; i < 15; i++) {
      corpse[`f${String(i).padStart(2, '0')}.txt`] = 'a\n';
      revived[`f${String(i).padStart(2, '0')}.txt`] = 'b\n';
    }
    const a = await buildAutopsy(await tree(corpse), await tree(revived), null);
    expect(a.causes).toHaveLength(LIMITS.causes);
    expect(a.skipped).toBe(3);
  });

  it('is deterministic', async () => {
    const corpse = await tree({ 'b.js': 'util.puts(1)\n', 'a.txt': 'x\n', 'package.json': pkg({ engines: { node: '1' } }) });
    const revived = await tree({ 'b.js': 'console.log(1)\n', 'a.txt': 'y\n', 'package.json': pkg({ engines: { node: '>=22' } }) });
    expect(await buildAutopsy(corpse, revived, null)).toEqual(await buildAutopsy(corpse, revived, null));
  });
});

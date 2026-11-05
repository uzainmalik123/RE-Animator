import { existsSync } from 'node:fs';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyRites } from './rites.js';

async function body(files: Record<string, unknown>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'rites-'));
  for (const [name, v] of Object.entries(files)) await writeFile(join(dir, name), typeof v === 'string' ? v : JSON.stringify(v, null, 2));
  return dir;
}
const pkgOf = async (dir: string) => JSON.parse(await readFile(join(dir, 'package.json'), 'utf8')) as Record<string, Record<string, string> | unknown>;
const npmrcOf = (dir: string) => readFile(join(dir, '.npmrc'), 'utf8');

describe('applyRites', () => {
  it('engines: frees a strict engine pin in package.json', async () => {
    const dir = await body({ 'package.json': { name: 'x', engines: { node: '0.10.x', npm: '2' }, engineStrict: true } });
    expect(await applyRites(dir)).toEqual(['engines']);
    const pkg = await pkgOf(dir);
    expect(pkg.engines).toEqual({ npm: '2' });
    expect(pkg.engineStrict).toBeUndefined();
  });

  it('engines: removes engine-strict from .npmrc and keeps its other lines', async () => {
    const dir = await body({ 'package.json': { name: 'x', engines: { node: '0.10.x' } }, '.npmrc': 'save-exact=true\nengine-strict=true\n' });
    expect(await applyRites(dir)).toEqual(['engines']);
    expect(await npmrcOf(dir)).toBe('save-exact=true\n');
    expect((await pkgOf(dir)).engines).toEqual({});
  });

  it('engines: leaves a pin alone when nothing makes it strict', async () => {
    const dir = await body({ 'package.json': { name: 'x', engines: { node: '0.10.x' } } });
    expect(await applyRites(dir)).toEqual([]);
    expect((await pkgOf(dir)).engines).toEqual({ node: '0.10.x' });
  });

  it('node-sass: swaps node-sass for sass in the same section', async () => {
    const dir = await body({ 'package.json': { name: 'x', devDependencies: { 'node-sass': '^4.14.1', a: '1' } } });
    expect(await applyRites(dir)).toEqual(['node-sass']);
    expect((await pkgOf(dir)).devDependencies).toEqual({ a: '1', sass: '^1.77.0' });
  });

  it.each([{ webpack: '^4.46.0' }, { 'react-scripts': '3.4.1' }])('openssl: lets old webpack hash (%o)', async (deps) => {
    const dir = await body({ 'package.json': { name: 'x', dependencies: deps } });
    expect(await applyRites(dir)).toEqual(['openssl']);
    expect(await npmrcOf(dir)).toBe('node-options=--openssl-legacy-provider\n');
  });

  it('openssl: leaves webpack 5 alone', async () => {
    const dir = await body({ 'package.json': { name: 'x', devDependencies: { webpack: '^5.0.0' } } });
    expect(await applyRites(dir)).toEqual([]);
  });

  it('lockfile: drops a v1 lockfile and installs with legacy peer deps', async () => {
    const dir = await body({ 'package.json': { name: 'x' }, 'package-lock.json': { lockfileVersion: 1 } });
    expect(await applyRites(dir)).toEqual(['lockfile']);
    expect(existsSync(join(dir, 'package-lock.json'))).toBe(false);
    expect(await npmrcOf(dir)).toBe('legacy-peer-deps=true\n');
  });

  it('lockfile: keeps a v3 lockfile', async () => {
    const dir = await body({ 'package.json': { name: 'x' }, 'package-lock.json': { lockfileVersion: 3 } });
    expect(await applyRites(dir)).toEqual([]);
    expect(existsSync(join(dir, 'package-lock.json'))).toBe(true);
  });

  it('applies all four in order, each .npmrc line once', async () => {
    const dir = await body({
      'package.json': { name: 'x', engineStrict: true, engines: { node: '4' }, dependencies: { 'node-sass': '4', webpack: '3.0.0' } },
      'package-lock.json': {},
      '.npmrc': 'legacy-peer-deps=true\n',
    });
    expect(await applyRites(dir)).toEqual(['engines', 'node-sass', 'openssl', 'lockfile']);
    expect(await npmrcOf(dir)).toBe('legacy-peer-deps=true\nnode-options=--openssl-legacy-provider\n');
  });

  it('does nothing without a package.json', async () => {
    expect(await applyRites(await body({ 'index.html': '<p>hi</p>' }))).toEqual([]);
  });

  it('does nothing to a malformed package.json', async () => {
    const dir = await body({ 'package.json': '{ "name": ' });
    expect(await applyRites(dir)).toEqual([]);
    expect(await readFile(join(dir, 'package.json'), 'utf8')).toBe('{ "name": ');
  });
});

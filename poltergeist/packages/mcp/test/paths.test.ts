import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { findConfig, PathError, projectRootOf, resolveInside } from '../src/paths.js';

describe('resolveInside', () => {
  it('resolves relative paths against root', () => {
    expect(resolveInside('/w', 'specs/a')).toBe('/w/specs/a');
    expect(resolveInside('/w', '/w')).toBe('/w');
    expect(resolveInside('/w', '/w/x')).toBe('/w/x');
  });

  it.each(['../etc', '/etc', 'a/../../x', '/w2', '/wx/y'])('rejects %s outside root', (p) => {
    expect(() => resolveInside('/w', p)).toThrow(PathError);
  });
});

describe('findConfig', () => {
  let root: string;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'mcp-paths-'));
    await mkdir(join(root, 'app', '.kiro', 'specs', 's'), { recursive: true });
    await mkdir(join(root, 'bare', 'specs', 's'), { recursive: true });
    await writeFile(join(root, 'poltergeist.config.json'), '{}');
    await writeFile(join(root, 'app', 'poltergeist.config.json'), '{}');
  });
  afterAll(() => rm(root, { recursive: true, force: true }));

  it('finds the nearest config walking up to root', () => {
    expect(findConfig(join(root, 'app', '.kiro', 'specs', 's'), root)).toBe(join(root, 'app', 'poltergeist.config.json'));
    expect(findConfig(join(root, 'bare', 'specs', 's'), root)).toBe(join(root, 'poltergeist.config.json'));
  });

  it('returns undefined when there is none up to root', () => {
    expect(findConfig(join(root, 'bare', 'specs', 's'), join(root, 'bare'))).toBeUndefined();
  });
});

describe('resolveInside with symlinks', () => {
  let root: string;
  let outside: string;
  beforeAll(async () => {
    root = await realpath(await mkdtemp(join(tmpdir(), 'mcp-link-root-')));
    outside = await realpath(await mkdtemp(join(tmpdir(), 'mcp-link-out-')));
    await mkdir(join(root, 'real'));
    await symlink(outside, join(root, 'escape'));
    await symlink(join(root, 'real'), join(root, 'inner'));
  });
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  });

  it('rejects a symlink that leaves root, and paths below it that do not exist yet', () => {
    expect(() => resolveInside(root, 'escape')).toThrow(PathError);
    expect(() => resolveInside(root, 'escape/new/dir')).toThrow(PathError);
  });

  it('allows symlinks that stay inside root, and a symlinked root', async () => {
    expect(resolveInside(root, 'inner')).toBe(join(root, 'inner'));
    const linkedRoot = join(outside, 'root-link');
    await symlink(root, linkedRoot);
    expect(resolveInside(linkedRoot, 'real')).toBe(join(linkedRoot, 'real'));
  });
});

describe('projectRootOf (--root-from-spec)', () => {
  it('takes the project above an absolute .kiro/specs/<name>', () => {
    expect(projectRootOf('/w/app/.kiro/specs/claims', '/h')).toBe('/w/app');
    expect(projectRootOf('/w/app/.kiro/specs/claims/', '/h')).toBe('/w/app');
    expect(projectRootOf('/w/app/x/../.kiro/specs/c', '/h')).toBe('/w/app');
  });

  it('asks for an absolute path', () => {
    expect(() => projectRootOf('.kiro/specs/claims', '/h')).toThrow(/absolute/);
    expect(() => projectRootOf('.kiro/specs/claims', '/h')).toThrow(PathError);
  });

  it.each(['/w/app/.kiro/specs', '/w/app/.kiro/specs/a/b', '/w/app/specs/a', '/w/app/kiro/specs/a'])('rejects %s (not <project>/.kiro/specs/<name>)', (p) => {
    expect(() => projectRootOf(p, '/h')).toThrow(PathError);
  });

  it('refuses the filesystem root and the home folder as a project', () => {
    expect(() => projectRootOf('/.kiro/specs/c', '/h')).toThrow(PathError);
    expect(() => projectRootOf('/h/.kiro/specs/c', '/h')).toThrow(PathError);
    expect(() => projectRootOf('/h/.kiro/specs/c', '/h/')).toThrow(PathError);
  });
});

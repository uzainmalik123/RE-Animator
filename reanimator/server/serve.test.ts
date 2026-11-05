import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { freePort, startApp, waitForHttp, type RunningApp } from './exec.js';
import { STATIC_SERVE, inferServe } from './serve.js';

async function body(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'serve-'));
  for (const [name, text] of Object.entries(files)) {
    await mkdir(join(dir, name, '..'), { recursive: true });
    await writeFile(join(dir, name), text);
  }
  return dir;
}

describe('inferServe', () => {
  it('runs npm start when there is a start script', async () => {
    const dir = await body({ 'package.json': JSON.stringify({ scripts: { start: 'node x.js' } }), 'index.html': 'x' });
    expect(await inferServe(dir)).toEqual(['npm', 'start']);
  });

  it('serves the first built folder holding an index.html', async () => {
    const dir = await body({ 'package.json': JSON.stringify({ scripts: { build: 'x' } }), 'build/index.html': 'x', 'public/index.html': 'y' });
    expect(await inferServe(dir)).toEqual(['node', STATIC_SERVE, join(dir, 'build')]);
  });

  it('serves the root when only it holds an index.html', async () => {
    const dir = await body({ 'index.html': 'x' });
    expect(await inferServe(dir)).toEqual(['node', STATIC_SERVE, dir]);
  });

  it('has no way to serve a body with neither', async () => {
    expect(await inferServe(await body({ 'package.json': '{}' }))).toBeNull();
  });
});

describe('static-serve.mjs', () => {
  let app: RunningApp | null = null;
  afterEach(async () => {
    await app?.stop();
    app = null;
  });

  async function serveDir(): Promise<string> {
    const dir = await body({ 'site/index.html': '<h1>risen</h1>', 'site/app.js': 'let x = 1;', 'secret.txt': 'TOPSECRET' });
    app = startApp(['node', STATIC_SERVE, join(dir, 'site')], { cwd: dir, port: await freePort() });
    expect((await waitForHttp(app.origin, { timeoutMs: 5000, exited: app.exited })).ok).toBe(true);
    return app.origin;
  }

  it('serves the index and files with their content type', async () => {
    const origin = await serveDir();
    expect(await (await fetch(origin)).text()).toBe('<h1>risen</h1>');
    const js = await fetch(`${origin}/app.js`);
    expect(js.headers.get('content-type')).toMatch(/^text\/javascript/);
  });

  it.each(['/%2e%2e/secret.txt', '/../secret.txt', '/%2e%2e%2fsecret.txt', '/nope.html'])('answers 404 for %s', async (path) => {
    const origin = await serveDir();
    const res = await fetch(`${origin}${path}`);
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain('TOPSECRET');
  });
});

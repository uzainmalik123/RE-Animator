import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { TAIL_BYTES, freePort, runCommand, startApp, waitForHttp } from './exec.js';

const node = process.execPath;
const cwd = tmpdir();

describe('runCommand', () => {
  it('captures stdout and stderr', async () => {
    const r = await runCommand([node, '-e', "console.log('hi');console.error('err')"], { cwd, timeoutMs: 10_000 });
    expect(r.code).toBe(0);
    expect(r.output).toContain('hi');
    expect(r.output).toContain('err');
    expect(r.timedOut).toBe(false);
  });

  it('reports a non-zero exit', async () => {
    const r = await runCommand([node, '-e', 'process.exit(3)'], { cwd, timeoutMs: 10_000 });
    expect(r.code).toBe(3);
  });

  it('kills a command that hangs past its timeout', async () => {
    const t0 = Date.now();
    const r = await runCommand([node, '-e', 'setInterval(()=>{},1000)'], { cwd, timeoutMs: 300 });
    expect(r.timedOut).toBe(true);
    expect(Date.now() - t0).toBeLessThan(2000);
  });

  it('keeps only the tail of long output', async () => {
    const r = await runCommand([node, '-e', "process.stdout.write('x'.repeat(10000))"], { cwd, timeoutMs: 10_000 });
    expect(r.output.length).toBeLessThanOrEqual(TAIL_BYTES);
    expect(r.output.length).toBeGreaterThan(0);
  });
});

describe('startApp + waitForHttp', () => {
  it('starts an app on a free loopback port and stops it', async () => {
    const port = await freePort();
    const app = startApp(
      [node, '-e', "require('http').createServer((q,s)=>s.end('up')).listen(+process.env.PORT, process.env.HOST)"],
      { cwd, port },
    );
    expect(app.origin).toBe(`http://127.0.0.1:${port}`);
    const up = await waitForHttp(app.origin, { timeoutMs: 10_000, exited: app.exited });
    expect(up.ok).toBe(true);
    await app.stop();
    await app.exited;
  });

  it('fails fast when the app crashes on start', async () => {
    const port = await freePort();
    const app = startApp([node, '-e', "console.error('boom');process.exit(1)"], { cwd, port });
    const t0 = Date.now();
    const up = await waitForHttp(app.origin, { timeoutMs: 10_000, exited: app.exited });
    expect(up.ok).toBe(false);
    expect(up.detail).toContain('exited');
    expect(Date.now() - t0).toBeLessThan(2000);
    expect(app.output()).toContain('boom');
  });

  it('times out when nothing answers', async () => {
    const port = await freePort();
    const app = startApp([node, '-e', 'setInterval(()=>{},1000)'], { cwd, port });
    const up = await waitForHttp(app.origin, { timeoutMs: 400, exited: app.exited });
    expect(up.ok).toBe(false);
    expect(up.detail).toMatch(/no answer/);
    await app.stop();
  });
});

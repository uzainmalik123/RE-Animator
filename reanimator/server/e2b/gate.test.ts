import { mkdtempSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createGate } from './gate.js';

const KEY = 'k'.repeat(32);
const servers: Server[] = [];

async function listen(s: Server): Promise<string> {
  servers.push(s);
  await new Promise<void>((r) => s.listen(0, '127.0.0.1', r));
  return `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => new Promise((r) => s.close(r))));
});

async function setup() {
  const root = mkdtempSync(join(tmpdir(), 'gate-'));
  writeFileSync(join(root, 'index.html'), '<p>crypt</p>');
  writeFileSync(join(root, 'app.js'), 'x');
  const seen: IncomingHttpHeaders[] = [];
  const backend = createServer((req, res) => {
    seen.push(req.headers);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ path: req.url }));
  });
  const b = new URL(await listen(backend));
  const gate = await listen(createGate({ key: KEY, root, backend: { host: '127.0.0.1', port: Number(b.port) } }));
  return { gate, seen };
}

const withKey = { cookie: `reanimator_key=${KEY}` };

describe('the E2B gate', () => {
  it('refuses callers without the key, and with a wrong one', async () => {
    const { gate, seen } = await setup();
    expect((await fetch(`${gate}/`)).status).toBe(401);
    expect((await fetch(`${gate}/api/health`)).status).toBe(401);
    expect((await fetch(`${gate}/api/health`, { headers: { cookie: 'reanimator_key=nope' } })).status).toBe(401);
    expect((await fetch(`${gate}/?key=nope`, { redirect: 'manual' })).status).toBe(401);
    expect(seen).toHaveLength(0);
  });

  it('trades ?key= for an HttpOnly cookie and drops it from the URL', async () => {
    const { gate } = await setup();
    const res = await fetch(`${gate}/?replay&key=${KEY}`, { redirect: 'manual' });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/?replay=');
    expect(res.headers.get('set-cookie')).toMatch(/^reanimator_key=k+; HttpOnly; Secure; SameSite=Strict; Path=\/$/);
  });

  it('serves the built UI, with index.html for app paths and 404 for missing files', async () => {
    const { gate } = await setup();
    expect(await (await fetch(`${gate}/`, { headers: withKey })).text()).toBe('<p>crypt</p>');
    expect((await fetch(`${gate}/app.js`, { headers: withKey })).headers.get('content-type')).toMatch(/javascript/);
    expect(await (await fetch(`${gate}/graveyard`, { headers: withKey })).text()).toBe('<p>crypt</p>');
    expect((await fetch(`${gate}/missing.js`, { headers: withKey })).status).toBe(404);
    expect((await fetch(`${gate}/..%2f..%2fetc%2fpasswd`, { headers: withKey })).status).toBe(404);
  });

  it('forwards /api with a loopback Host and no Origin, Referer or cookie', async () => {
    const { gate, seen } = await setup();
    const res = await fetch(`${gate}/api/rituals?x=1`, { method: 'POST', headers: { ...withKey, origin: 'https://8080-abc.e2b.app', referer: 'https://8080-abc.e2b.app/' }, body: '{}' });
    expect(await res.json()).toEqual({ path: '/api/rituals?x=1' });
    expect(seen[0]?.host).toMatch(/^127\.0\.0\.1:\d+$/);
    expect(seen[0]?.origin).toBeUndefined();
    expect(seen[0]?.referer).toBeUndefined();
    expect(seen[0]?.cookie).toBeUndefined();
  });
});

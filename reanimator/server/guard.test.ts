import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { loopbackGuard } from './guard.js';

const app = new Hono().use('*', loopbackGuard()).get('/x', (c) => c.text('ok'));
const req = (headers: Record<string, string>) => app.request('http://127.0.0.1:7070/x', { headers });

describe('loopbackGuard (KI-R12)', () => {
  it('lets a loopback Host with no Origin through', async () => {
    expect((await req({ host: '127.0.0.1:7070' })).status).toBe(200);
  });

  it('lets the Vite dev origin through', async () => {
    expect((await req({ host: 'localhost:5173', origin: 'http://localhost:5173' })).status).toBe(200);
  });

  it('accepts IPv6 loopback', async () => {
    expect((await req({ host: '[::1]:7070', origin: 'http://[::1]:5173' })).status).toBe(200);
  });

  it('refuses a rebinding Host', async () => {
    expect((await req({ host: 'evil.example' })).status).toBe(403);
  });

  it('refuses a foreign Origin', async () => {
    expect((await req({ host: '127.0.0.1:7070', origin: 'http://evil.example' })).status).toBe(403);
  });

  it('refuses an opaque null Origin', async () => {
    expect((await req({ host: '127.0.0.1:7070', origin: 'null' })).status).toBe(403);
  });

  it('refuses a lookalike host', async () => {
    expect((await req({ host: 'localhost.evil.example' })).status).toBe(403);
  });
});

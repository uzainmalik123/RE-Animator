// R7: a spell over the real routes and the real Grimoire, with the fake kiro-cli (no Kiro tokens).
import { chmod, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { Grimoire } from './grimoire.js';

const FAKE_KIRO = fileURLToPath(new URL('./fixtures/fake-kiro.mjs', import.meta.url));
const BASE = 'http://127.0.0.1:7070';

describe('a spell cast through the backend', () => {
  it('runs kiro-cli in the body, streams to the seal, and the body is edited', async () => {
    await chmod(FAKE_KIRO, 0o755);
    const body = await mkdtemp(join(tmpdir(), 'r7-body-'));
    const server = join(body, 'server.js');
    await writeFile(server, 'a\nb\n');
    const rituals = { start: () => ({ id: 'r1' }), events: () => null, subscribe: () => () => {}, body: (id: string) => (id === 'r1' ? { origin: null, revivedDir: body, fixture: {} as never } : null) };
    const attacks = { start: () => ({ id: 'a1' }), events: () => null, subscribe: () => () => {}, frame: async () => null };
    const grimoire = new Grimoire({ rituals, attacking: () => false, cli: FAKE_KIRO, env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? ''} });
    const app = createApp({ rituals, attacks, grimoire });

    const res = await app.request(`${BASE}/api/rituals/r1/spells`, { method: 'POST', body: JSON.stringify({ text: 'Fix 1.2' }), headers: { 'content-type': 'application/json' } });
    expect(res.status).toBe(202);
    const { id } = (await res.json()) as { id: string };
    const sse = await (await app.request(`${BASE}/api/spells/${id}/events`)).text();
    expect(sse).toContain('"type":"cast"');
    expect(sse).toContain('"type":"ruled"');
    expect(sse).toContain('"stopReason":"end_turn"');
    expect(await readFile(server, 'utf8')).toContain('// healed');
  });
});

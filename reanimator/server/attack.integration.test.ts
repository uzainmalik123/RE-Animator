// The real thing: the practice corpse raised for real, then the real Poltergeist CLI run against it,
// deliberately with no LLM key. Scout really walks the guestbook and the chart really parses; the
// run must stop at the compiler with the credentials error. That proves the wiring without spending
// tokens in CI (the live run with a key is `npm run attack:check`, KI-R15).
import { existsSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AttackEvent } from '../shared/attack.js';
import type { RitualEvent } from '../shared/ritual.js';
import { Attacks } from './attack.js';
import { DEFAULT_CLI } from './engine.js';
import { freePort, runCommand, startApp, waitForHttp } from './exec.js';
import { PRACTICE_CORPSE, loadFixture } from './fixtures.js';
import { renderCheck } from './render-check.js';
import { Rituals } from './ritual.js';

async function until<E>(read: () => { log: E[]; done: boolean } | null, ms: number): Promise<E[]> {
  const deadline = Date.now() + ms;
  for (;;) {
    const ev = read();
    if (ev?.done || Date.now() > deadline) return ev?.log ?? [];
    await new Promise((res) => setTimeout(res, 100));
  }
}

describe('Death on the practice corpse, with no key', () => {
  it.skipIf(!existsSync(DEFAULT_CLI))('scouts the revived guestbook and stops at the compiler', { timeout: 180_000 }, async () => {
    const r = new Rituals({ fixture: () => loadFixture(PRACTICE_CORPSE), deps: { runCommand, startApp, freePort, waitForHttp, renderCheck } });
    const attacks = new Attacks({
      rituals: r,
      homeRoot: await mkdtemp(join(tmpdir(), 'r3-home-')),
      cli: DEFAULT_CLI,
      env: { PATH: process.env.PATH, HOME: process.env.HOME },
    });
    try {
      const s = r.start();
      if ('busy' in s) throw new Error('busy');
      const ritual: RitualEvent[] = await until(() => r.events(s.id), 85_000);
      expect(ritual.at(-1)?.type).toBe('risen');
      const a = attacks.start(s.id);
      if (!('id' in a) || 'busy' in a) throw new Error(JSON.stringify(a));
      const log: AttackEvent[] = await until(() => attacks.events(a.id), 90_000);
      const engine = log.flatMap((e) => (e.type === 'engine' ? [e.event] : []));
      const started = engine.find((e) => e.type === 'run.started');
      expect(started).toMatchObject({ criteria: ['1.1', '1.2', '1.3', '2.1', '2.2', '2.3'] });
      expect(engine.some((e) => e.type === 'scout.route' && e.path === '/')).toBe(true);
      expect(log.at(-1)).toMatchObject({ type: 'failed' });
      expect((log.at(-1) as { reason: string }).reason).toMatch(/LLM client could not be set up|ANTHROPIC_API_KEY|credentials/);
    } finally {
      await attacks.stop();
      await r.dispose();
    }
  });
});

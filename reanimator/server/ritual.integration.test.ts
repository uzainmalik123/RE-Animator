// The real thing: npm, a real child server and headless Chromium on the practice corpse.
// Needs Chromium once per machine: npx playwright-core install chromium.
import { describe, expect, it } from 'vitest';
import { IDLE, reduceRitual, type RitualEvent } from '../shared/ritual.js';
import { freePort, runCommand, startApp, waitForHttp } from './exec.js';
import { PRACTICE_CORPSE, loadFixture } from './fixtures.js';
import { renderCheck } from './render-check.js';
import { Rituals } from './ritual.js';

describe('a real ritual on the practice corpse', () => {
  it('flatlines on EBADENGINE, then rises and serves the guestbook', { timeout: 90_000 }, async () => {
    const r = new Rituals({ fixture: () => loadFixture(PRACTICE_CORPSE), deps: { runCommand, startApp, freePort, waitForHttp, renderCheck } });
    const s = r.start();
    if ('busy' in s) throw new Error('busy');
    let log: RitualEvent[] = [];
    for (let i = 0; i < 850; i++) {
      const ev = r.events(s.id)!;
      log = ev.log;
      if (ev.done) break;
      await new Promise((res) => setTimeout(res, 100));
    }
    try {
      const state = log.reduce(reduceRitual, IDLE);
      expect(state.corpse[0]).toMatchObject({ vital: 'install', ok: false });
      expect(state.corpse[0]!.detail).toContain('EBADENGINE');
      expect(state.revived.map((v) => v.ok)).toEqual([true, true, true, true]);
      expect(state.status).toBe('risen');
      expect(state.origin).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
      expect(await (await fetch(state.origin!)).text()).toContain('Guestbook');
    } finally {
      await r.dispose();
    }
  });
});

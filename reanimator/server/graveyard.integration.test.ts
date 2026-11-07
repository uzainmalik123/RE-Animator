// The real thing for every prepared grave (R6): npm, a real child server and headless Chromium.
// Each grave must really die at its stated vital and really rise after its remedy (D-R11).
// Needs Chromium once per machine: npx playwright-core install chromium.
import { describe, expect, it } from 'vitest';
import { IDLE, reduceRitual, type RitualEvent, type VitalName } from '../shared/ritual.js';
import { freePort, runCommand, startApp, waitForHttp } from './exec.js';
import { loadFixture } from './fixtures.js';
import { graveDir } from './graveyard.js';
import { renderCheck } from './render-check.js';
import { Rituals } from './ritual.js';

const GRAVES: [id: string, diesAt: VitalName, page: string][] = [
  ['practice-corpse', 'install', 'Guestbook'],
  ['sundial-2015', 'build', 'Sundial'],
  ['tally-2014', 'serve', 'Tally'],
];

describe('every prepared grave, really raised', () => {
  it.each(GRAVES)('%s flatlines at %s, then rises and serves', { timeout: 90_000 }, async (id, diesAt, page) => {
    const dir = await graveDir(id);
    if (!dir) throw new Error(`no grave ${id}`);
    const r = new Rituals({ fixture: () => loadFixture(dir), deps: { runCommand, startApp, freePort, waitForHttp, renderCheck } });
    const s = r.start({ grave: id });
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
      // The corpse passes every vital before its death and fails exactly the stated one.
      expect(state.corpse.at(-1)).toMatchObject({ vital: diesAt, ok: false });
      expect(state.corpse.slice(0, -1).every((v) => v.ok)).toBe(true);
      expect(state.revived.map((v) => v.ok)).toEqual([true, true, true, true]);
      expect(state.status).toBe('risen');
      expect(await (await fetch(state.origin!)).text()).toContain(page);
    } finally {
      await r.dispose();
    }
  });
});

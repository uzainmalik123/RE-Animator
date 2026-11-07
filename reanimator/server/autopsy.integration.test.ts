// The real autopsy for every prepared grave (R8): the real ritual (npm, a real child server and
// headless Chromium) must explain each death from the real corpse and remedy, and the corpse's real
// failing output must name the cause that killed it (D-R11).
// Needs Chromium once per machine: npx playwright-core install chromium.
import { describe, expect, it } from 'vitest';
import type { Autopsy } from '../shared/autopsy.js';
import type { RitualEvent, VitalName } from '../shared/ritual.js';
import { freePort, runCommand, startApp, waitForHttp } from './exec.js';
import { loadFixture } from './fixtures.js';
import { graveDir } from './graveyard.js';
import { renderCheck } from './render-check.js';
import { Rituals } from './ritual.js';

// [grave, vital it dies at, the cause that killed it, the cause that was only modernised]
const GRAVES: [id: string, diesAt: VitalName, killer: string, bystander: string][] = [
  ['practice-corpse', 'install', 'engine-pin', 'removed-api'],
  ['sundial-2015', 'build', 'removed-api', 'engine-pin'],
  ['tally-2014', 'serve', 'removed-api', 'engine-pin'],
];

describe('every prepared grave, really explained', () => {
  it.each(GRAVES)('%s: died at %s of %s', { timeout: 90_000 }, async (id, diesAt, killer, bystander) => {
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
      const types = log.map((e) => e.type);
      expect(types.indexOf('autopsy')).toBe(types.indexOf('remedy') + 1);
      const autopsy = (log.find((e) => e.type === 'autopsy') as { autopsy: Autopsy }).autopsy;
      expect(autopsy.diedAt).toBe(diesAt);
      expect(autopsy.symptom).not.toBe('');
      const kinds = autopsy.causes.map((c) => c.kind);
      expect(kinds).toContain(killer);
      expect(kinds).toContain(bystander);
      // What killed it was named by the real failing output; what was merely modernised was not.
      for (const c of autopsy.causes) expect(c.seen, `${c.kind} ${c.file}`).toBe(c.kind === killer);
      for (const c of autopsy.causes) expect(c.lines.some((l) => l.op !== ' ')).toBe(true);
      expect(log.at(-1)?.type).toBe('risen');
    } finally {
      await r.dispose();
    }
  });
});

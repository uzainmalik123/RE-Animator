// R5: a heal edits the revived body, and only a real re-raise serves the edit (the app never reloads).
// Needs Chromium once per machine: npx playwright-core install chromium.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { VitalResult } from '../shared/ritual.js';
import { freePort, runCommand, startApp, waitForHttp } from './exec.js';
import { PRACTICE_CORPSE, loadFixture } from './fixtures.js';
import { renderCheck } from './render-check.js';
import { Rituals } from './ritual.js';

describe('a real re-raise on the practice corpse', () => {
  it('serves the edited body', { timeout: 150_000 }, async () => {
    const r = new Rituals({ fixture: () => loadFixture(PRACTICE_CORPSE), deps: { runCommand, startApp, freePort, waitForHttp, renderCheck } });
    const s = r.start();
    if ('busy' in s) throw new Error('busy');
    try {
      for (let i = 0; i < 850 && !r.events(s.id)!.done; i++) await new Promise((res) => setTimeout(res, 100));
      const body = r.body(s.id);
      expect(body).not.toBeNull();
      const server = join(body!.revivedDir, 'server.js');
      await writeFile(server, (await readFile(server, 'utf8')).replaceAll('Guestbook', 'Healed guestbook'));
      const pulses: VitalResult[] = [];
      const out = await r.reraise(s.id, (v) => pulses.push(v));
      expect(pulses.map((p) => `${p.vital}:${p.ok}`)).toEqual(['install:true', 'build:true', 'serve:true', 'render:true']);
      if (!('origin' in out)) throw new Error(out.failed);
      expect(await (await fetch(out.origin)).text()).toContain('Healed guestbook');
    } finally {
      await r.dispose();
    }
  });
});

// The real thing for R9: a dead repo cloned from git, its corpse proven dead in the bubblewrap
// sandbox, a rite applied, and the body raised on real npm, a real server and headless Chromium.
// Skipped where bubblewrap can't make a sandbox. Needs Chromium: npx playwright-core install chromium.
import { describe, expect, it } from 'vitest';
import { IDLE, reduceRitual, type RitualEvent } from '../shared/ritual.js';
import { freePort, runCommand, startApp, waitForHttp } from './exec.js';
import { graveFixture } from './grave.js';
import { renderCheck } from './render-check.js';
import { Rituals } from './ritual.js';
import { hasBwrap } from './sandbox.js';
import { localRepo } from './test-repo.js';

const SERVER = `const http = require('http');
http.createServer((q, s) => { s.writeHead(200, { 'content-type': 'text/html' }); s.end('<h1>The old guestbook</h1>'); })
  .listen(Number(process.env.PORT), process.env.HOST);
`;

describe('a real ritual on an unprepared grave', async () => {
  const available = await hasBwrap();
  it.skipIf(!available)('flatlines on a strict engine pin, takes the engines rite, and rises in the sandbox', { timeout: 120_000 }, async () => {
    const src = await localRepo({
      'package.json': JSON.stringify({ name: 'old-guestbook', license: 'MIT', engines: { node: '0.10.x' }, engineStrict: true, scripts: { start: 'node server.js' } }),
      '.npmrc': 'engine-strict=true\n',
      'server.js': SERVER,
    });
    const r = new Rituals({
      fixture: (_req, workdir, signal) => graveFixture(src, workdir, { run: runCommand, signal, name: 'someone/old-guestbook' }),
      deps: { runCommand, startApp, freePort, waitForHttp, renderCheck },
    });
    const s = r.start({ repo: src });
    if ('busy' in s) throw new Error('busy');
    let log: RitualEvent[] = [];
    for (let i = 0; i < 1100; i++) {
      const ev = r.events(s.id)!;
      log = ev.log;
      if (ev.done) break;
      await new Promise((res) => setTimeout(res, 100));
    }
    try {
      const state = log.reduce(reduceRitual, IDLE);
      expect(state.repo).toBe('someone/old-guestbook');
      expect(state.corpse[0]).toMatchObject({ vital: 'install', ok: false });
      expect(state.corpse[0]!.detail).toContain('EBADENGINE');
      expect(state.rites).toEqual(['engines']);
      expect(state.revived.map((v) => v.ok)).toEqual([true, true, true, true]);
      expect(await (await fetch(state.origin!)).text()).toContain('The old guestbook');
    } finally {
      await r.dispose();
    }
  });
});

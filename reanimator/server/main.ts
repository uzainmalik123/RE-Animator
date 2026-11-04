import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { freePort, runCommand, startApp, waitForHttp } from './exec.js';
import { PRACTICE_CORPSE, loadFixture } from './fixtures.js';
import { resolvePort } from './port.js';
import { renderCheck } from './render-check.js';
import { Rituals } from './ritual.js';

// Loopback only: this backend runs install/build/serve commands, so it must never face the LAN.
const hostname = '127.0.0.1';
const port = resolvePort(process.env.REANIMATOR_PORT);

// v1 raises the practice corpse; the real demo repo (KI-R1) is another fixture folder (D-R14).
const rituals = new Rituals({
  fixture: () => loadFixture(PRACTICE_CORPSE),
  deps: { runCommand, startApp, freePort, waitForHttp, renderCheck },
});

serve({ fetch: createApp({ rituals }).fetch, hostname, port }, (info) => {
  console.log(`Reanimator backend listening on http://${hostname}:${info.port}`);
});

// Never leave a revived app running (and holding a port) after the backend stops.
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.once(sig, () => {
    void rituals.dispose().finally(() => process.exit(0));
  });
}

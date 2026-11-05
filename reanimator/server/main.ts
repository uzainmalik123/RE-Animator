import { serve } from '@hono/node-server';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { Attacks } from './attack.js';
import { DEFAULT_CLI } from './engine.js';
import { freePort, runCommand, startApp, waitForHttp } from './exec.js';
import { PRACTICE_CORPSE, loadFixture } from './fixtures.js';
import { Grimoire } from './grimoire.js';
import { DEFAULT_KIRO } from './kiro.js';
import { resolvePort } from './port.js';
import { renderCheck } from './render-check.js';
import { Rituals } from './ritual.js';

// Loopback only: this backend runs install/build/serve commands, so it must never face the LAN.
const hostname = '127.0.0.1';
const port = resolvePort(process.env.REANIMATOR_PORT);

// v1 raises the practice corpse; the real demo repo (KI-R1) is another fixture folder (D-R14).
// Death's attack and Kiro's spell stop before the app does (onRelease), on a new ritual or shutdown.
const rituals: Rituals = new Rituals({
  fixture: () => loadFixture(PRACTICE_CORPSE),
  deps: { runCommand, startApp, freePort, waitForHttp, renderCheck },
  onRelease: () => Promise.all([attacks.stop(), grimoire.stop()]).then(() => undefined),
});
// The engine's config, plan cache and runs persist here per fixture (D-R16); gitignored.
const attacks: Attacks = new Attacks({
  rituals,
  homeRoot: fileURLToPath(new URL('../.reanimator', import.meta.url)),
  cli: process.env.REANIMATOR_POLTERGEIST ?? DEFAULT_CLI,
  env: process.env,
  casting: () => grimoire.busy(),
});
// R7: the grimoire drives the real Kiro agent (kiro-cli) on the revived body, never during Death.
const grimoire: Grimoire = new Grimoire({ rituals, attacking: () => attacks.busy(), cli: process.env.REANIMATOR_KIRO ?? DEFAULT_KIRO, env: process.env });

serve({ fetch: createApp({ rituals, attacks, grimoire }).fetch, hostname, port }, (info) => {
  console.log(`Reanimator backend listening on http://${hostname}:${info.port}`);
});

// Never leave a revived app running (and holding a port) after the backend stops.
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.once(sig, () => {
    void rituals.dispose().finally(() => process.exit(0));
  });
}

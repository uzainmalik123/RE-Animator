// R3's Done-when, by hand (KI-R15): raise the practice corpse, let Death attack it with the real
// engine and a real LLM key, and print the wounds. Exits 0 only when at least one finding reproduced.
//   doppler run -- npm run attack:check   (or with the keys in the repo's .env)
import { fileURLToPath } from 'node:url';
import { reduceAttack, QUIET, type AttackEvent } from '../shared/attack.js';
import type { RitualEvent } from '../shared/ritual.js';
import { Attacks } from './attack.js';
import { loadDotEnv } from './dotenv.js';
import { DEFAULT_CLI } from './engine.js';
import { freePort, runCommand, startApp, waitForHttp } from './exec.js';
import { PRACTICE_CORPSE, loadFixture } from './fixtures.js';
import { renderCheck } from './render-check.js';
import { Rituals } from './ritual.js';

loadDotEnv();

async function until<E>(read: () => { log: E[]; done: boolean } | null): Promise<E[]> {
  for (;;) {
    const ev = read();
    if (ev?.done) return ev.log;
    await new Promise((res) => setTimeout(res, 250));
  }
}

const rituals = new Rituals({ fixture: () => loadFixture(PRACTICE_CORPSE), deps: { runCommand, startApp, freePort, waitForHttp, renderCheck } });
const attacks = new Attacks({
  rituals,
  homeRoot: fileURLToPath(new URL('../.reanimator', import.meta.url)),
  cli: process.env.REANIMATOR_POLTERGEIST ?? DEFAULT_CLI,
  env: process.env,
});

let code = 1;
try {
  const s = rituals.start();
  if ('busy' in s) throw new Error('a ritual is already running');
  const ritual: RitualEvent[] = await until(() => rituals.events(s.id));
  const last = ritual.at(-1);
  if (last?.type !== 'risen') throw new Error(`the ritual did not rise: ${JSON.stringify(last)}`);
  console.log(`risen at ${last.origin}; summoning Death…`);
  const a = attacks.start(s.id);
  if (!('id' in a) || 'busy' in a) throw new Error(JSON.stringify(a));
  const log: AttackEvent[] = await until(() => attacks.events(a.id));
  const state = log.reduce(reduceAttack, QUIET);
  if (state.status === 'failed') throw new Error(`Death faltered: ${state.failure}`);
  console.log(`counts: ${JSON.stringify(state.counts)}`);
  for (const w of state.wounds) console.log(`wound ${w.criterion} ${w.persona}: ${w.reason}`);
  code = state.wounds.length > 0 ? 0 : 1;
  if (code === 1) console.log('no wounds: Death found nothing that reproduced');
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
} finally {
  await attacks.stop();
  await rituals.dispose();
}
process.exit(code);

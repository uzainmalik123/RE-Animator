// Host a live Reanimator in an E2B sandbox (D-R26). Run from reanimator/ with E2B_API_KEY set:
//   npm run e2b:up [-- --minutes 60]    create a sandbox, upload this checkout, boot, print the link
//   npm run e2b:down -- <sandbox id>    kill it early
// The sandbox gets this repo's reanimator/ and poltergeist/ (tracked + untracked, never ignored
// files such as .env), installs and builds them, starts the backend on loopback and the gate on
// :8080, and prints the gate's public link with its key. ANTHROPIC_* / AWS_* are forwarded only so
// Death can run; Kiro (the grimoire) isn't installed there.
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Sandbox } from 'e2b';

const HOME = '/home/user';
const NODE_MAJOR = 22;
const GATE_PORT = 8080;

function repoRoot(): string {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
}

// The checkout as a tarball: git's view of the two projects, so ignored files never leave the machine.
function packCheckout(root: string): Buffer {
  const listed = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--deduplicate', '--', 'reanimator', 'poltergeist'], { cwd: root, encoding: 'utf8' });
  const files = listed.split('\0').filter((f) => f && existsSync(join(root, f)));
  const out = join(tmpdir(), `reanimator-e2b-${process.pid}.tgz`);
  execFileSync('tar', ['-czf', out, '--null', '-T', '-'], { cwd: root, input: files.join('\0') });
  try {
    return readFileSync(out);
  } finally {
    rmSync(out, { force: true });
  }
}

function forwardedEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) if (v && (k.startsWith('ANTHROPIC_') || k.startsWith('AWS_'))) out[k] = v;
  return out;
}

async function step(sbx: Sandbox, label: string, cmd: string, o: { cwd?: string; envs?: Record<string, string>; minutes?: number } = {}): Promise<void> {
  console.log(`· ${label}`);
  const tail: string[] = [];
  const keep = (d: string) => {
    tail.push(d);
    if (tail.length > 40) tail.shift();
  };
  try {
    await sbx.commands.run(cmd, { cwd: o.cwd, envs: o.envs, timeoutMs: (o.minutes ?? 10) * 60_000, onStdout: keep, onStderr: keep });
  } catch (err) {
    console.error(tail.join(''));
    throw new Error(`${label} failed: ${(err as Error).message}`);
  }
}

async function up(minutes: number): Promise<void> {
  const root = repoRoot();
  const tgz = packCheckout(root);
  const secrets = forwardedEnv(process.env);
  console.log(`Packed ${(tgz.length / 1e6).toFixed(1)} MB. Forwarding: ${Object.keys(secrets).join(', ') || 'none (Death will need an LLM key)'}`);

  const sbx = await Sandbox.create({ timeoutMs: minutes * 60_000, metadata: { app: 'reanimator' } });
  console.log(`Sandbox ${sbx.sandboxId} (alive ${minutes} min)`);
  try {
    await sbx.files.write(`${HOME}/src.tgz`, tgz.buffer.slice(tgz.byteOffset, tgz.byteOffset + tgz.byteLength) as ArrayBuffer);
    await step(sbx, 'unpack', `mkdir -p ${HOME}/app && tar -xzf ${HOME}/src.tgz -C ${HOME}/app && rm ${HOME}/src.tgz`);
    await step(
      sbx,
      `Node ${NODE_MAJOR}, git, bubblewrap`,
      `set -e
       if ! node -v 2>/dev/null | grep -q '^v${NODE_MAJOR}\\.'; then
         f=$(curl -fsSL https://nodejs.org/dist/latest-v${NODE_MAJOR}.x/SHASUMS256.txt | grep -o 'node-v[0-9.]*-linux-x64.tar.xz' | head -1)
         curl -fsSL https://nodejs.org/dist/latest-v${NODE_MAJOR}.x/$f | sudo tar -xJ -C /usr/local --strip-components=1
       fi
       sudo apt-get update -qq && sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq git bubblewrap >/dev/null`,
    );
    await step(sbx, 'install Poltergeist', 'npm ci --no-audit --no-fund', { cwd: `${HOME}/app/poltergeist` });
    await step(sbx, 'install + build Reanimator', 'npm ci --no-audit --no-fund && npm run build', { cwd: `${HOME}/app/reanimator` });
    await step(sbx, 'Chromium', 'sudo env PATH="$PATH" npx playwright-core install-deps chromium && npx playwright-core install chromium', { cwd: `${HOME}/app/reanimator` });

    const key = randomBytes(24).toString('base64url');
    const app = `${HOME}/app/reanimator`;
    await sbx.commands.run(`npm run server > ${HOME}/backend.log 2>&1`, { cwd: app, envs: secrets, background: true });
    await sbx.commands.run(`npx tsx server/e2b/gate.ts > ${HOME}/gate.log 2>&1`, { cwd: app, envs: { REANIMATOR_GATE_KEY: key, REANIMATOR_GATE_PORT: String(GATE_PORT) }, background: true });
    await step(sbx, 'wait for the backend and gate', `for i in $(seq 60); do curl -fs 127.0.0.1:7070/api/health >/dev/null && curl -s -o /dev/null 127.0.0.1:${GATE_PORT} && exit 0; sleep 1; done; cat ${HOME}/backend.log ${HOME}/gate.log; exit 1`, { minutes: 2 });

    console.log(`\nReanimator is risen:\n  https://${sbx.getHost(GATE_PORT)}/?key=${key}\n`);
    console.log('Anyone with that link can raise repos and spend the forwarded key. Share it with care.');
    console.log(`It dies in ${minutes} min, or now with: npm run e2b:down -- ${sbx.sandboxId}`);
  } catch (err) {
    await sbx.kill().catch(() => undefined);
    throw err;
  }
}

const [cmd, ...rest] = process.argv.slice(2);
if (existsSync('.env')) process.loadEnvFile('.env');
if (!process.env.E2B_API_KEY) {
  console.error('Set E2B_API_KEY first: in reanimator/.env (gitignored), or `doppler run -- npm run e2b:up`.');
  process.exit(1);
}
if (cmd === 'down') {
  if (!rest[0]) throw new Error('usage: npm run e2b:down -- <sandbox id>');
  console.log((await Sandbox.kill(rest[0])) ? 'Killed.' : 'No such sandbox.');
} else {
  const i = rest.indexOf('--minutes');
  const minutes = i >= 0 ? Number(rest[i + 1]) : 60;
  if (!Number.isFinite(minutes) || minutes < 5) throw new Error('--minutes must be a number >= 5');
  await up(minutes);
}

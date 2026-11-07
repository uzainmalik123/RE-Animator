// One-line launch profiles (D-R27): check reanimator/.env for what the profile needs, then start the
// backend (or the E2B host) with Death's LLM and the grimoire's Kiro set.
//   npm run server:free [-- groq]    free LLM (REANIMATOR_FREE_LLM, default gemini) + the fake Kiro
//   npm run server:paid [-- claude]  Claude (REANIMATOR_PAID_LLM, default bedrock) + the real Kiro
//   npm run e2b:free / e2b:paid [-- <provider>] [-- --minutes 30]   the same, hosted on E2B
// The profile always wins over REANIMATOR_LLM / REANIMATOR_LLM_MODEL / REANIMATOR_KIRO in .env.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type Tier = 'free' | 'paid';
export type Where = 'local' | 'e2b';
export const PROVIDERS = { free: ['gemini', 'groq', 'ollama'], paid: ['bedrock', 'claude'] } as const;

const FAKE_KIRO = fileURLToPath(new URL('./fixtures/fake-kiro.mjs', import.meta.url));
const set = (env: NodeJS.ProcessEnv, k: string) => Boolean(env[k]?.trim());

export type Launch = { env: Record<string, string>; kiro: 'fake' | 'real'; summary: string; errors: string[] };

/** Pure: what a profile sets, and everything missing for it (all at once, so one edit of .env fixes it). */
export function resolveProfile(o: { tier: Tier; provider?: string; where: Where; env: NodeJS.ProcessEnv; hasKiro: boolean }): Launch {
  const { tier, env } = o;
  const errors: string[] = [];
  const provider = o.provider ?? env[tier === 'free' ? 'REANIMATOR_FREE_LLM' : 'REANIMATOR_PAID_LLM']?.trim() ?? (tier === 'free' ? 'gemini' : 'bedrock');
  const allowed: readonly string[] = PROVIDERS[tier];
  if (!allowed.includes(provider)) errors.push(`"${provider}" isn't a ${tier} provider; use one of: ${allowed.join(', ')}`);
  const need = (k: string, why: string) => {
    if (!set(env, k)) errors.push(`${k} is empty (${why})`);
  };

  let model = '';
  if (provider === 'gemini' || provider === 'groq' || provider === 'ollama') {
    const up = provider.toUpperCase();
    if (provider !== 'ollama') need(`${up}_API_KEY`, `the ${provider} key`);
    need(`${up}_MODEL`, `a ${provider} model id for Death`);
    model = env[`${up}_MODEL`]?.trim() ?? '';
    if (provider === 'ollama' && o.where === 'e2b') errors.push('ollama runs only on this machine, not on E2B');
  } else if (provider === 'claude') {
    need('ANTHROPIC_API_KEY', 'the Anthropic key');
    model = env.CLAUDE_MODEL?.trim() ?? '';
  } else if (provider === 'bedrock') {
    if (!set(env, 'AWS_REGION') && !set(env, 'AWS_DEFAULT_REGION')) errors.push('AWS_REGION is empty (the Bedrock region)');
    const creds = set(env, 'AWS_BEARER_TOKEN_BEDROCK') || set(env, 'AWS_PROFILE') || (set(env, 'AWS_ACCESS_KEY_ID') && set(env, 'AWS_SECRET_ACCESS_KEY'));
    if (!creds) errors.push('no AWS credentials: set AWS_BEARER_TOKEN_BEDROCK, or AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY, or AWS_PROFILE');
    model = env.CLAUDE_MODEL?.trim() ?? '';
  }

  const kiro = tier === 'free' ? 'fake' : 'real';
  if (kiro === 'real' && !o.hasKiro) errors.push('kiro-cli is not on PATH (the real grimoire needs it installed and logged in)');
  if (o.where === 'e2b') need('E2B_API_KEY', 'the E2B key');

  const llm = provider === 'claude' ? 'anthropic' : provider;
  // Empty strings, not deletes: the backend loads .env again, and an unset key would come back from it.
  const out: Record<string, string> = { REANIMATOR_LLM: llm, REANIMATOR_LLM_MODEL: model };
  if (o.where === 'local') out.REANIMATOR_KIRO = kiro === 'fake' ? FAKE_KIRO : 'kiro-cli';
  const summary = `${tier}: Death plans with ${provider}${model ? ` (${model})` : ''} · the grimoire uses ${kiro === 'fake' ? 'the fake Kiro (no tokens)' : 'real Kiro (spends credit)'}${o.where === 'e2b' ? ' · on E2B' : ''}`;
  return { env: out, kiro, summary, errors };
}

function hasKiroCli(): boolean {
  try {
    execFileSync('sh', ['-c', 'command -v kiro-cli'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const [where, tier, ...rest] = process.argv.slice(2);
  if ((where !== 'local' && where !== 'e2b') || (tier !== 'free' && tier !== 'paid')) {
    throw new Error('usage: tsx server/launch.ts <local|e2b> <free|paid> [provider] [--minutes N]');
  }
  const envFile = fileURLToPath(new URL('../.env', import.meta.url));
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  else console.warn('No reanimator/.env: reading your shell only (cp .env.example .env to start one).');

  const provider = rest[0] && !rest[0].startsWith('--') ? rest[0] : undefined;
  const launch = resolveProfile({ tier, ...(provider ? { provider } : {}), where, env: process.env, hasKiro: hasKiroCli() });
  if (launch.errors.length) {
    console.error(`Can't start ${tier}${provider ? ` (${provider})` : ''}. Fix in reanimator/.env:`);
    for (const e of launch.errors) console.error(`  ✗ ${e}`);
    process.exit(1);
  }
  Object.assign(process.env, launch.env);
  console.log(`☠  ${launch.summary}`);

  if (where === 'local') {
    await import('./main.js');
  } else {
    const i = rest.indexOf('--minutes');
    const minutes = i >= 0 ? Number(rest[i + 1]) : 60;
    if (!Number.isFinite(minutes) || minutes < 5) throw new Error('--minutes must be a number >= 5');
    const { up } = await import('./e2b/up.js');
    await up(minutes, launch.kiro);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) await main();

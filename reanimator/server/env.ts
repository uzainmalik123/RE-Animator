// What the backend's children may see (KI-R14 #4). The backend holds secrets (Doppler, the LLM key);
// install scripts and the revived app get none of them, and only the engine gets the LLM's.
const BASE_KEYS = ['PATH', 'HOME', 'TMPDIR', 'TEMP', 'LANG', 'LC_ALL', 'TERM', 'USER', 'SHELL'];
// Playwright finds Chromium through these; ANTHROPIC_* and AWS_* configure the compiler (Anthropic or Bedrock).
const ENGINE_KEYS = ['PLAYWRIGHT_BROWSERS_PATH', 'XDG_CACHE_HOME'];

function pick(base: NodeJS.ProcessEnv, keep: (key: string) => boolean): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {};
  for (const [k, v] of Object.entries(base)) if (v !== undefined && keep(k)) out[k] = v;
  return out;
}

export function childEnv(base: NodeJS.ProcessEnv, extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  return { ...pick(base, (k) => BASE_KEYS.includes(k) || k.startsWith('npm_config_')), ...extra };
}

// The Poltergeist CLI: the child env plus the compiler's credentials (Anthropic or Bedrock), colour off.
export function engineEnv(base: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return { ...childEnv(base), ...pick(base, (k) => ENGINE_KEYS.includes(k) || k.startsWith('ANTHROPIC_') || k.startsWith('AWS_')), NO_COLOR: '1' };
}

// Kiro (R7, D-R21): the child env plus the XDG dirs where kiro-cli keeps its login. No LLM key, no
// AWS or Doppler secrets: Kiro brings its own account.
export function kiroEnv(base: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return { ...childEnv(base), ...pick(base, (k) => k.startsWith('XDG_')) };
}

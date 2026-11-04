// What the backend's children may see (KI-R14 #4). The backend holds secrets (Doppler, the LLM key);
// install scripts and the revived app get none of them, and only the engine gets the LLM's.
const BASE_KEYS = ['PATH', 'HOME', 'TMPDIR', 'TEMP', 'LANG', 'LC_ALL', 'TERM', 'USER', 'SHELL'];
const ENGINE_KEYS = ['ANTHROPIC_API_KEY', 'ANTHROPIC_BASE_URL'];

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
  return { ...childEnv(base), ...pick(base, (k) => ENGINE_KEYS.includes(k) || k.startsWith('AWS_')), NO_COLOR: '1' };
}

// The repo's one env file (D-R30): <repo root>/.env, gitignored, templated by <repo root>/.env.example.
// Anything already set by the shell or Doppler wins over it (process.loadEnvFile never overrides).
// Only Reanimator reads it; Poltergeist gets just its LLM keys from Reanimator (engineEnv), never the file.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const ENV_FILE = fileURLToPath(new URL('../../.env', import.meta.url));

/** Loads the repo's .env if there is one; returns whether it did. */
export function loadDotEnv(): boolean {
  if (!existsSync(ENV_FILE)) return false;
  process.loadEnvFile(ENV_FILE);
  return true;
}

import type { LoadedConfig } from '../config/load.js';
import type { HouseRules } from './rules.js';

/**
 * The config with the house rules' `forbid` rules appended (F17, D-45). Steering only tightens:
 * nothing else in the config changes, and the input is not mutated. Persona flags and notes are
 * applied by `summon()`.
 */
export function applyHouseRules(loaded: LoadedConfig, rules: HouseRules): LoadedConfig {
  const key = (r: { method: string; path: string }) => `${r.method.toUpperCase()} ${r.path}`;
  const seen = new Set(loaded.config.forbidden.map(key));
  const extra = rules.forbidden.filter((r) => !seen.has(key(r)) && seen.add(key(r)));
  if (extra.length === 0) return loaded;
  return { ...loaded, config: { ...loaded.config, forbidden: [...loaded.config.forbidden, ...extra.map((r) => ({ ...r, method: r.method.toUpperCase() }))] } };
}

import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import type { LlmProvider } from '../config/schema.js';
import { listGenerators } from '../personas/generators/index.js';
import type { Persona, PersonaId } from '../personas/registry.js';
import { HauntingPlanSchema, PlanRouteSchema } from './dsl.js';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

/** Over everything about a persona that reaches the prompt; UI copy (name, tagline, sprite) is excluded. */
export function personaHash(persona: Persona): string {
  const gens = new Set<string>(persona.generators);
  const generators = listGenerators()
    .filter((g) => gens.has(g.id))
    .map(({ id, description }) => ({ id, description }));
  const { behaviour, allowedSteps, actors } = persona;
  return sha(JSON.stringify({ behaviour, allowedSteps, generators, actors })).slice(0, 16);
}

export type CacheKeyInput = {
  criterionHash: string;
  personaId: PersonaId;
  personaHash: string;
  routes: { path: string; identity: string; routeHash: string }[];
  model: string;
  /** F19. `anthropic` or absent keeps the pre-F19 key. */
  provider?: LlmProvider;
  promptVersion: string;
  /** House-rule route notes for these routes (F17), by path. Empty or absent keeps the pre-F17 key. */
  notes?: Record<string, string>;
};

/** Req 5.5. Routes include path and identity, because `routeHash` covers only the elements. */
export function cacheKey(k: CacheKeyInput): string {
  const routes = k.routes.map((r) => `${r.path}@${r.identity}:${r.routeHash}`).sort();
  const parts: unknown[] = [k.criterionHash, k.personaId, k.personaHash, routes, k.model, k.promptVersion];
  const notes = Object.entries(k.notes ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  if (notes.length > 0) parts.push(notes);
  if (k.provider && k.provider !== 'anthropic') parts.push({ provider: k.provider });
  return sha(JSON.stringify(parts)).slice(0, 32);
}

const CachedResultSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('plan'), plan: HauntingPlanSchema }),
  z.strictObject({ kind: z.literal('notApplicable'), reason: z.string(), routes: z.array(PlanRouteSchema) }),
]);
export type CachedResult = z.infer<typeof CachedResultSchema>;

/** A missing, unreadable, corrupt or stale-shaped entry is a miss, never an error. */
export async function readCache(dir: string, key: string): Promise<CachedResult | undefined> {
  try {
    const parsed = CachedResultSchema.safeParse(JSON.parse(await readFile(join(dir, `${key}.json`), 'utf8')));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

/** Atomic: written to a temp file, then renamed into place. */
export async function writeCache(dir: string, key: string, value: CachedResult): Promise<void> {
  await mkdir(dir, { recursive: true });
  const tmp = join(dir, `.${key}.${randomBytes(4).toString('hex')}.tmp`);
  try {
    await writeFile(tmp, JSON.stringify(value, null, 2) + '\n');
    await rename(tmp, join(dir, `${key}.json`));
  } catch (err) {
    await rm(tmp, { force: true }).catch(() => undefined);
    throw err;
  }
}

import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compile } from '../../src/compiler/compile.js';
import { CACHE_ONLY_MESSAGE, cacheOnlyLlm } from '../../src/compiler/llm.js';
import { criterion } from './criteria.js';
import { VALID, fakeLlm, output } from './fake-llm.js';
import { HOME_DOWN, MARKET, TRADE } from './scout-fixtures.js';

// F21 (D-49): the sandbox compiles from the plan cache only and never calls an LLM.

const SCOUT = { routes: [HOME_DOWN, MARKET, TRADE] };
const CLAIM = criterion('3.2', 'WHEN two sessions claim Sour Skulls at once, THE Market SHALL accept only one claim.');
const opts = (cacheDir: string) => ({ model: 'claude-sonnet-5-5', cacheDir });

describe('cacheOnlyLlm', () => {
  it('compiles every pair from a warm cache with no LLM call', async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), 'cache-only-'));
    const warm = fakeLlm((req) => output(VALID[req.meta.persona]));
    await compile([CLAIM], SCOUT, { ...opts(cacheDir), personas: ['wraith', 'doppelganger'], client: warm.client });
    const res = await compile([CLAIM], SCOUT, { ...opts(cacheDir), personas: ['wraith', 'doppelganger'], client: cacheOnlyLlm() });
    expect(res.llmCalls).toBe(0);
    expect(res.pairs.map((p) => p.status !== 'uncompilable' && p.cached)).toEqual([true, true]);
  });

  it('turns a cache miss into an uncompilable pair', async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), 'cache-only-'));
    const res = await compile([CLAIM], SCOUT, { ...opts(cacheDir), personas: ['wraith'], client: cacheOnlyLlm() });
    expect(res.pairs[0]).toMatchObject({ status: 'uncompilable', reason: `llm error: ${CACHE_ONLY_MESSAGE}`, attempts: 1 });
    expect(CACHE_ONLY_MESSAGE).toBe('not in the plan cache (cache-only run)');
  });
});

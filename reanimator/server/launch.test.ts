import { describe, expect, it } from 'vitest';
import { resolveProfile } from './launch.js';

const base = { where: 'local' as const, hasKiro: true };

describe('resolveProfile (D-R27)', () => {
  it('free defaults to gemini with its model and the fake Kiro', () => {
    const l = resolveProfile({ ...base, tier: 'free', env: { GEMINI_API_KEY: 'g', GEMINI_MODEL: 'gm' } });
    expect(l.errors).toEqual([]);
    expect(l.kiro).toBe('fake');
    expect(l.env).toMatchObject({ REANIMATOR_LLM: 'gemini', REANIMATOR_LLM_MODEL: 'gm' });
    expect(l.env.REANIMATOR_KIRO).toMatch(/server\/fixtures\/fake-kiro\.mjs$/);
    expect(l.summary).toContain('gemini (gm)');
  });

  it('a provider argument, then REANIMATOR_FREE_LLM, pick the free provider', () => {
    const env = { REANIMATOR_FREE_LLM: 'groq', GROQ_API_KEY: 'q', GROQ_MODEL: 'qm', OLLAMA_MODEL: 'om' };
    expect(resolveProfile({ ...base, tier: 'free', env }).env.REANIMATOR_LLM).toBe('groq');
    expect(resolveProfile({ ...base, tier: 'free', provider: 'ollama', env }).env).toMatchObject({ REANIMATOR_LLM: 'ollama', REANIMATOR_LLM_MODEL: 'om' });
  });

  it('paid defaults to bedrock with the real Kiro; claude maps to anthropic; CLAUDE_MODEL is optional', () => {
    const bedrock = resolveProfile({ ...base, tier: 'paid', env: { AWS_REGION: 'us-east-1', AWS_BEARER_TOKEN_BEDROCK: 'b' } });
    expect(bedrock.errors).toEqual([]);
    expect(bedrock.env).toEqual({ REANIMATOR_LLM: 'bedrock', REANIMATOR_LLM_MODEL: '', REANIMATOR_KIRO: 'kiro-cli' });
    expect(bedrock.kiro).toBe('real');
    const claude = resolveProfile({ ...base, tier: 'paid', provider: 'claude', env: { ANTHROPIC_API_KEY: 'a', CLAUDE_MODEL: 'cm' } });
    expect(claude.env).toMatchObject({ REANIMATOR_LLM: 'anthropic', REANIMATOR_LLM_MODEL: 'cm' });
  });

  it('lists everything missing at once', () => {
    const l = resolveProfile({ tier: 'paid', where: 'e2b', hasKiro: false, env: {} });
    expect(l.errors).toEqual([
      'AWS_REGION is empty (the Bedrock region)',
      'no AWS credentials: set AWS_BEARER_TOKEN_BEDROCK, or AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY, or AWS_PROFILE',
      'kiro-cli is not on PATH (the real grimoire needs it installed and logged in)',
      'E2B_API_KEY is empty (the E2B key)',
    ]);
  });

  it('a blank key counts as missing, and a model is required for the free providers', () => {
    const l = resolveProfile({ ...base, tier: 'free', env: { GEMINI_API_KEY: '  ' } });
    expect(l.errors).toEqual(['GEMINI_API_KEY is empty (the gemini key)', 'GEMINI_MODEL is empty (a gemini model id for Death)']);
  });

  it('refuses a paid provider on free (no spending by accident) and the reverse', () => {
    expect(resolveProfile({ ...base, tier: 'free', provider: 'claude', env: {} }).errors[0]).toMatch(/"claude" isn't a free provider; use one of: gemini, groq, ollama/);
    expect(resolveProfile({ ...base, tier: 'paid', provider: 'gemini', env: {} }).errors[0]).toMatch(/"gemini" isn't a paid provider/);
  });

  it('refuses ollama on E2B, and leaves REANIMATOR_KIRO to e2b:up there', () => {
    const l = resolveProfile({ tier: 'free', provider: 'ollama', where: 'e2b', hasKiro: true, env: { OLLAMA_MODEL: 'om', E2B_API_KEY: 'e' } });
    expect(l.errors).toEqual(['ollama runs only on this machine, not on E2B']);
    expect(l.env).not.toHaveProperty('REANIMATOR_KIRO');
  });
});

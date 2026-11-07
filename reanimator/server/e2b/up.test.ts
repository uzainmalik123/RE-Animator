import { describe, expect, it } from 'vitest';
import { forwardedEnv } from './up.js';

describe('forwardedEnv (D-R27)', () => {
  it('forwards the LLM settings (Claude, Bedrock, the free providers, the choice) and nothing else', () => {
    const env = forwardedEnv({
      ANTHROPIC_API_KEY: 'a', AWS_REGION: 'r', GEMINI_API_KEY: 'g', GROQ_API_KEY: 'q', REANIMATOR_LLM: 'groq', REANIMATOR_LLM_MODEL: 'm',
      E2B_API_KEY: 'e', DOPPLER_TOKEN: 'd', GITHUB_TOKEN: 't', HOME: '/h', REANIMATOR_KIRO: '/k', EMPTY_KEY: '',
    });
    expect(env).toEqual({ ANTHROPIC_API_KEY: 'a', AWS_REGION: 'r', GROQ_API_KEY: 'q', REANIMATOR_LLM: 'groq', REANIMATOR_LLM_MODEL: 'm' });
  });
});

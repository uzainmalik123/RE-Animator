import { describe, expect, it } from 'vitest';
import { childEnv, engineEnv } from './env.js';

describe('childEnv', () => {
  it('keeps only the allowlisted keys and npm_config_*', () => {
    const env = childEnv({ PATH: '/b', HOME: '/h', ANTHROPIC_API_KEY: 'k', DOPPLER_TOKEN: 'd', npm_config_cache: '/c' });
    expect(env).toEqual({ PATH: '/b', HOME: '/h', npm_config_cache: '/c' });
  });

  it('adds the extras', () => {
    expect(childEnv({ PATH: '/b' }, { PORT: '1' }).PORT).toBe('1');
  });
});

describe('engineEnv', () => {
  it('also passes the LLM credentials and turns colour off, but nothing else', () => {
    const env = engineEnv({ PATH: '/b', ANTHROPIC_API_KEY: 'k', AWS_REGION: 'r', DOPPLER_TOKEN: 'd' });
    expect(env).toEqual({ PATH: '/b', ANTHROPIC_API_KEY: 'k', AWS_REGION: 'r', NO_COLOR: '1' });
  });
});

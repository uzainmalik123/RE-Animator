import { describe, expect, it } from 'vitest';
import { childEnv, engineEnv, kiroEnv } from './env.js';

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
  it('passes what Playwright needs to find Chromium and every ANTHROPIC_ setting', () => {
    const env = engineEnv({ PLAYWRIGHT_BROWSERS_PATH: '/pw', XDG_CACHE_HOME: '/x', ANTHROPIC_BEDROCK_MANTLE_BASE_URL: 'u' });
    expect(env).toEqual({ PLAYWRIGHT_BROWSERS_PATH: '/pw', XDG_CACHE_HOME: '/x', ANTHROPIC_BEDROCK_MANTLE_BASE_URL: 'u', NO_COLOR: '1' });
  });

  it('also passes the LLM credentials and turns colour off, but nothing else', () => {
    const env = engineEnv({ PATH: '/b', ANTHROPIC_API_KEY: 'k', AWS_REGION: 'r', DOPPLER_TOKEN: 'd' });
    expect(env).toEqual({ PATH: '/b', ANTHROPIC_API_KEY: 'k', AWS_REGION: 'r', NO_COLOR: '1' });
  });
});

describe('kiroEnv', () => {
  it('passes what Kiro needs to find its login, and no secrets', () => {
    const env = kiroEnv({ PATH: '/b', HOME: '/h', XDG_CONFIG_HOME: '/c', XDG_DATA_HOME: '/d', ANTHROPIC_API_KEY: 'k', AWS_SECRET_ACCESS_KEY: 's', DOPPLER_TOKEN: 'd' });
    expect(env).toEqual({ PATH: '/b', HOME: '/h', XDG_CONFIG_HOME: '/c', XDG_DATA_HOME: '/d' });
  });
});

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
    const env = engineEnv({ PATH: '/b', ANTHROPIC_API_KEY: 'k', AWS_REGION: 'r', GEMINI_API_KEY: 'g', GROQ_API_KEY: 'q', DOPPLER_TOKEN: 'd', E2B_API_KEY: 'e' });
    expect(env).toEqual({ PATH: '/b', ANTHROPIC_API_KEY: 'k', AWS_REGION: 'r', GROQ_API_KEY: 'q', NO_COLOR: '1' });
  });
});

describe('empty values (D-R28)', () => {
  it('are never passed to a child, so an empty AWS_PROFILE from .env.example cannot steer the SDK', () => {
    const env = engineEnv({ PATH: '/b', AWS_PROFILE: '', AWS_ACCESS_KEY_ID: '', AWS_BEARER_TOKEN_BEDROCK: 'b', GROQ_API_KEY: '' });
    expect(env).toEqual({ PATH: '/b', AWS_BEARER_TOKEN_BEDROCK: 'b', NO_COLOR: '1' });
  });
});

describe('kiroEnv', () => {
  it('passes what Kiro needs to find its login, and no secrets', () => {
    const env = kiroEnv({ PATH: '/b', HOME: '/h', XDG_CONFIG_HOME: '/c', XDG_DATA_HOME: '/d', ANTHROPIC_API_KEY: 'k', AWS_SECRET_ACCESS_KEY: 's', DOPPLER_TOKEN: 'd' });
    expect(env).toEqual({ PATH: '/b', HOME: '/h', XDG_CONFIG_HOME: '/c', XDG_DATA_HOME: '/d' });
  });
});

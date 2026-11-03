import { describe, expect, it } from 'vitest';
import { clientKey, createRateLimiter } from '../../src/sandbox/limit.js';

const HOUR = 3_600_000;

describe('createRateLimiter', () => {
  it('allows perHour runs per client in a sliding hour', () => {
    let now = 1_000;
    const limiter = createRateLimiter({ perHour: 2, now: () => now });
    expect(limiter.check('a')).toEqual({ ok: true });
    limiter.record('a');
    now += 1_000;
    limiter.record('a');
    expect(limiter.check('a')).toEqual({ ok: false, retryAfterSec: 3599 });
    expect(limiter.check('b')).toEqual({ ok: true });
    now = 1_000 + HOUR + 1;
    expect(limiter.check('a')).toEqual({ ok: true });
  });

  it('never limits with perHour 0', () => {
    const limiter = createRateLimiter({ perHour: 0 });
    for (let i = 0; i < 50; i++) limiter.record('a');
    expect(limiter.check('a')).toEqual({ ok: true });
  });

  it('asks for at least a second', () => {
    let now = 0;
    const limiter = createRateLimiter({ perHour: 1, now: () => now });
    limiter.record('a');
    now = HOUR - 1;
    expect(limiter.check('a')).toEqual({ ok: false, retryAfterSec: 1 });
  });
});

describe('clientKey', () => {
  const req = (xff?: string) => ({ socket: { remoteAddress: '10.0.0.9' }, headers: xff ? { 'x-forwarded-for': xff } : {} });

  it('uses the socket address unless the proxy is trusted', () => {
    expect(clientKey(req('1.2.3.4, 10.0.0.1'), false)).toBe('10.0.0.9');
    expect(clientKey(req('1.2.3.4, 10.0.0.1'), true)).toBe('1.2.3.4');
    expect(clientKey(req(), true)).toBe('10.0.0.9');
    expect(clientKey({ socket: {}, headers: {} }, false)).toBe('unknown');
  });
});

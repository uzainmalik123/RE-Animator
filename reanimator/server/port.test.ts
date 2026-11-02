import { describe, expect, it } from 'vitest';
import { resolvePort } from './port.js';

describe('resolvePort', () => {
  it('defaults to 7070 when unset', () => {
    expect(resolvePort(undefined)).toBe(7070);
  });

  it('uses a valid port', () => {
    expect(resolvePort('7071')).toBe(7071);
  });

  it('rejects empty, non-numeric and out-of-range values instead of binding a random port', () => {
    for (const raw of ['', ' ', 'abc', '0', '-1', '65536', '70.5']) {
      expect(() => resolvePort(raw), raw).toThrow(/REANIMATOR_PORT/);
    }
  });
});

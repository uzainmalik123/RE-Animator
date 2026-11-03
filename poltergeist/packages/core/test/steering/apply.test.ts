import { describe, expect, it } from 'vitest';
import { parseConfig } from '../../src/config/load.js';
import { applyHouseRules } from '../../src/steering/apply.js';

const loaded = () =>
  parseConfig(
    { target: 'http://localhost:4000', routes: [{ path: '/', auth: false }], forbidden: [{ method: 'GET', path: '/a' }] },
    { configPath: '/p/poltergeist.config.json', env: {} },
  );

describe('applyHouseRules', () => {
  it('appends new forbid rules after the config ones, dropping duplicates', () => {
    const before = loaded();
    const after = applyHouseRules(before, {
      path: '/p/x.md',
      disabled: [],
      forbidden: [{ method: 'get', path: '/a' }, { method: 'POST', path: '/b' }],
      notes: [],
    });
    expect(after.config.forbidden).toEqual([{ method: 'GET', path: '/a' }, { method: 'POST', path: '/b' }]);
    expect(before.config.forbidden).toEqual([{ method: 'GET', path: '/a' }]);
    expect(after.allowedHosts).toBe(before.allowedHosts);
    expect(after.config.target).toBe(before.config.target);
    expect(after.config.concurrency).toBe(before.config.concurrency);
  });
});

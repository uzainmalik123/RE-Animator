import { describe, expect, it } from 'vitest';
import { byDeath, isGraveId, isHeadstone, type Headstone } from './graveyard.js';

const stone = (o: Partial<Headstone>): Headstone => ({ id: 'a', name: 'a', diedIn: 2016, licence: 'MIT', chart: true, ...o });

describe('isGraveId', () => {
  it('accepts plain directory names', () => {
    for (const id of ['sundial-2015', 'practice-corpse', 'a', '0x']) expect(isGraveId(id)).toBe(true);
  });

  it('refuses anything that is not a plain name', () => {
    for (const id of ['', '../x', 'a/b', 'a\\b', '.', '..', '-a', 'A', 'a_b', '__proto__', 'a b', 'a'.repeat(65)]) expect(isGraveId(id)).toBe(false);
    for (const id of [5, null, undefined, {}, ['a']]) expect(isGraveId(id)).toBe(false);
  });
});

describe('byDeath', () => {
  it('orders by the year they died, then by name', () => {
    const sorted = [stone({ name: 'b', diedIn: 2016 }), stone({ name: 'z', diedIn: 2014 }), stone({ name: 'a', diedIn: 2016 }), stone({ name: 'm', diedIn: 2015 })].sort(byDeath);
    expect(sorted.map((s) => s.name)).toEqual(['z', 'm', 'a', 'b']);
  });
});

describe('isHeadstone', () => {
  it('accepts a headstone and refuses malformed ones', () => {
    expect(isHeadstone(stone({}))).toBe(true);
    for (const bad of [null, 'x', {}, stone({ id: '../x' }), stone({ name: '' }), { ...stone({}), diedIn: 'old' }, { ...stone({}), diedIn: 2016.5 }, { ...stone({}), chart: 'yes' }, { ...stone({}), licence: 3 }]) {
      expect(isHeadstone(bad)).toBe(false);
    }
  });
});

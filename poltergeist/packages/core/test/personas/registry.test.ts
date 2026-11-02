import { describe, expect, it } from 'vitest';
import {
  GENERATOR_IDS,
  PERSONA_IDS,
  STEP_TYPES,
  UnknownPersonaError,
  getDevice,
  getPersona,
  isPersonaId,
  listPersonas,
} from '../../src/personas/index.js';
import { THEME_WORDS } from '../helpers/theme-words.js';

describe('STEP_TYPES', () => {
  it('is the 14-step DSL vocabulary, frozen', () => {
    expect(STEP_TYPES).toEqual([
      'goto', 'click', 'dblclick', 'fill', 'press', 'back', 'reload', 'wait', 'throttle',
      'barrier', 'holdRequests', 'releaseRequests', 'login', 'logout',
    ]);
    expect(Object.isFrozen(STEP_TYPES)).toBe(true);
  });
});

describe('listPersonas', () => {
  it('lists the five built-in personas in order', () => {
    expect(listPersonas().map((p) => p.id)).toEqual(['wraith', 'banshee', 'doppelganger', 'lich', 'revenant']);
    expect(listPersonas().map((p) => p.name)).toEqual(['Wraith', 'Banshee', 'Doppelgänger', 'Lich', 'Revenant']);
    expect(PERSONA_IDS).toEqual(['wraith', 'banshee', 'doppelganger', 'lich', 'revenant']);
  });

  it('uses the persona id as the sprite reference', () => {
    for (const p of listPersonas()) expect(p.sprite).toBe(p.id);
  });
});

describe('allocations', () => {
  it('wraith', () => {
    const p = getPersona('wraith');
    expect(p.allowedSteps).toEqual(['goto', 'click', 'dblclick', 'fill', 'press', 'back', 'reload', 'wait']);
    expect(p.generators).toEqual(['plain']);
    expect(p.actors).toBe(1);
  });

  it('banshee', () => {
    const p = getPersona('banshee');
    expect(p.allowedSteps).toEqual(['goto', 'click', 'fill', 'press', 'wait']);
    expect(p.generators).toEqual(['naughty', 'emoji', 'rtl', 'long', 'empty', 'whitespace', 'fastcheck']);
    expect(p.actors).toBe(1);
  });

  it('doppelganger', () => {
    const p = getPersona('doppelganger');
    expect(p.allowedSteps).toEqual([
      'goto', 'click', 'fill', 'press', 'reload', 'wait', 'barrier', 'holdRequests', 'releaseRequests',
    ]);
    expect(p.generators).toEqual(['plain']);
    expect(p.actors).toBe(2);
  });

  it('lich', () => {
    const p = getPersona('lich');
    expect(p.allowedSteps).toEqual(['goto', 'click', 'fill', 'press', 'back', 'reload', 'wait', 'throttle']);
    expect(p.generators).toEqual(['plain']);
    expect(p.actors).toBe(1);
    expect(p.device).toBe('small-slow');
  });

  it('revenant', () => {
    const p = getPersona('revenant');
    expect(p.allowedSteps).toEqual(['goto', 'click', 'fill', 'press', 'back', 'reload', 'wait', 'barrier', 'login', 'logout']);
    expect(p.generators).toEqual(['plain']);
    expect(p.actors).toBe(2);
    expect(p.device).toBeUndefined();
  });

  it('only the lich has a device', () => {
    expect(listPersonas().filter((p) => p.device).map((p) => p.id)).toEqual(['lich']);
  });
});

describe('getDevice', () => {
  it('small-slow is a fixed, frozen preset', () => {
    const d = getDevice('small-slow');
    expect(d).toEqual({
      id: 'small-slow',
      viewport: { width: 360, height: 640 },
      isMobile: true,
      hasTouch: true,
      cpuSlowdown: 4,
      label: '360×640 phone, 4× slower CPU',
    });
    expect(Object.isFrozen(d)).toBe(true);
    expect(Object.isFrozen(d.viewport)).toBe(true);
  });

  it('throws on an unknown device', () => {
    expect(() => getDevice('tablet' as never)).toThrow(/unknown device/);
  });
});

describe('integrity', () => {
  it('steps and generators exist, without duplicates', () => {
    for (const p of listPersonas()) {
      for (const s of p.allowedSteps) expect(STEP_TYPES).toContain(s);
      for (const g of p.generators) expect(GENERATOR_IDS).toContain(g);
      expect(new Set(p.allowedSteps).size).toBe(p.allowedSteps.length);
      expect(new Set(p.generators).size).toBe(p.generators.length);
    }
    const ids = listPersonas().map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives throttle only to the lich and login/logout only to the revenant (F16)', () => {
    const having = (s: string) => listPersonas().filter((p) => (p.allowedSteps as readonly string[]).includes(s)).map((p) => p.id);
    expect(having('throttle')).toEqual(['lich']);
    expect(having('login')).toEqual(['revenant']);
    expect(having('logout')).toEqual(['revenant']);
  });
});

describe('text fields', () => {
  it('tagline is one short line', () => {
    for (const p of listPersonas()) {
      expect(p.tagline.length).toBeGreaterThan(0);
      expect(p.tagline.length).toBeLessThanOrEqual(80);
      expect(p.tagline).not.toMatch(/\n/);
    }
  });

  it('behaviour is plain QA wording with no theme words (D-09)', () => {
    for (const p of listPersonas()) {
      expect(p.behaviour.length).toBeGreaterThanOrEqual(80);
      const lower = p.behaviour.toLowerCase();
      for (const w of THEME_WORDS) expect(lower).not.toContain(w);
    }
  });
});

describe('getPersona', () => {
  it.each(['Wraith', '__proto__', 'toString', 'changeling', 'Lich', ''])('unknown id %j throws UnknownPersonaError', (id) => {
    expect(() => getPersona(id)).toThrow(UnknownPersonaError);
    try {
      getPersona(id);
    } catch (e) {
      expect((e as UnknownPersonaError).id).toBe(id);
    }
  });

  it('isPersonaId only accepts built-in ids', () => {
    expect(isPersonaId('banshee')).toBe(true);
    expect(isPersonaId('constructor')).toBe(false);
  });

  it('returns frozen data that callers cannot change', () => {
    const p = getPersona('wraith');
    expect(Object.isFrozen(p)).toBe(true);
    expect(Object.isFrozen(p.allowedSteps)).toBe(true);
    expect(Object.isFrozen(p.generators)).toBe(true);
    expect(() => (p.allowedSteps as string[]).push('login')).toThrow(TypeError);
    expect(getPersona('wraith').allowedSteps).not.toContain('login');
  });
});

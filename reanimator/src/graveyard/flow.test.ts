import { describe, expect, it } from 'vitest';
import { GRAVEYARD, RAISE, afterStart, walkingTo, walked } from './flow';

describe('afterStart', () => {
  it('sends Kiro walking to the stone of an accepted prepared grave', () => {
    expect(afterStart(GRAVEYARD, { grave: 'tally-2014' }, true, false)).toEqual({ at: 'graveyard', chosen: 'tally-2014' });
  });

  it('goes straight to the raise under reduced motion', () => {
    expect(afterStart(GRAVEYARD, { grave: 'tally-2014' }, true, true)).toBe(RAISE);
  });

  it('goes straight to the raise for a URL grave, which has no stone', () => {
    expect(afterStart(GRAVEYARD, { repo: 'https://github.com/a/b' }, true, false)).toBe(RAISE);
  });

  it('stays in the graveyard, walking nowhere, when the backend refused', () => {
    for (const reduce of [false, true]) {
      expect(afterStart(GRAVEYARD, { grave: 'tally-2014' }, false, reduce)).toBe(GRAVEYARD);
      expect(afterStart(GRAVEYARD, { repo: 'x' }, false, reduce)).toBe(GRAVEYARD);
    }
  });
});

describe('walked', () => {
  it('hands the stage to the raise once Kiro has arrived', () => {
    expect(walked({ at: 'graveyard', chosen: 'tally-2014' })).toBe(RAISE);
  });

  it('does nothing when no one is walking, or the raise already has the stage', () => {
    expect(walked(GRAVEYARD)).toBe(GRAVEYARD);
    expect(walked(RAISE)).toBe(RAISE);
  });
});

describe('walkingTo', () => {
  it('names the stone Kiro walks to, or none', () => {
    expect(walkingTo({ at: 'graveyard', chosen: 'a' })).toBe('a');
    expect(walkingTo(GRAVEYARD)).toBeNull();
    expect(walkingTo(RAISE)).toBeNull();
  });
});

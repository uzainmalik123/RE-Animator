import { describe, expect, it } from 'vitest';
import { buildTimeline, estimateFrameTimes, foldLive, stateAt, timelineDuration, type FrameMark } from '../../src/live/index.js';
import type { SummonEvent } from '../../src/summon/types.js';

// PRD F15 (D-43): a recording placed in time, so a renderer can play or scrub it.

const G = '3.2__doppelganger__r1__a';
const events: SummonEvent[] = [
  {
    type: 'run.started', t: 1000, runId: 'r1', runDir: '/run', specDir: '/spec', target: 'http://127.0.0.1:4000',
    criteria: ['3.1', '3.2'], personas: ['doppelganger'], reps: 1,
  },
  { type: 'rep.started', t: 1050, rep: 1 },
  { type: 'ghost.spawned', t: 1100, ghostId: G, criterion: '3.2', persona: 'doppelganger', rep: 1, actor: 'a' },
  { type: 'assert.result', t: 1300, criterion: '3.2', persona: 'doppelganger', rep: 1, index: 0, ok: false, detail: 'two claims' },
  { type: 'rep.finished', t: 1400, rep: 1, outcomes: { completed: 1, timeout: 0, planError: 0, systemError: 0 } },
  { type: 'verdict.criterion', t: 1450, criterion: '3.2', verdict: 'haunted' },
  { type: 'run.finished', t: 1500, runId: 'r1', counts: { clean: 0, haunted: 1, flaky: 0, inconclusive: 0, notApplicable: 0, uncompilable: 0 }, haunted: ['3.2'], durationMs: 500 },
] as SummonEvent[];
const frames: FrameMark[] = [
  { ghostId: G, seq: 1, t: 1300 },
  { ghostId: G, seq: 0, t: 1200 },
  { ghostId: 'nobody', seq: 0, t: 1200 },
];

describe('buildTimeline', () => {
  it('orders events and frames by time from the first event, events first on ties, dropping orphan frames', () => {
    const tl = buildTimeline(events, frames);
    expect(tl.map((e) => ('event' in e ? `${e.at}:${e.event.type}` : `${e.at}:frame${e.frame.seq}`))).toEqual([
      '0:run.started', '50:rep.started', '100:ghost.spawned', '200:frame0', '300:assert.result', '300:frame1',
      '400:rep.finished', '450:verdict.criterion', '500:run.finished',
    ]);
    expect(timelineDuration(tl)).toBe(500);
    expect(timelineDuration([])).toBe(0);
  });

  it('clamps an entry earlier than the first event to 0', () => {
    expect(buildTimeline(events, [{ ghostId: G, seq: 0, t: 900 }]).find((e) => 'frame' in e)?.at).toBe(0);
  });
});

describe('stateAt', () => {
  const tl = buildTimeline(events, frames);

  it('folds only what happened by then', () => {
    expect(stateAt(tl, 0).phase).toBe('scouting');
    expect(stateAt(tl, 120).lines.find((l) => l.id === '3.2')?.status).toBe('running');
  });

  it('equals foldLive at the end when no frame data is given', () => {
    expect(stateAt(tl, timelineDuration(tl))).toEqual(foldLive(events));
  });

  it('turns frames into ghost.frame messages when frame data is given', () => {
    const s = stateAt(tl, 1000, (f) => `img${f.seq}`);
    expect(s.ghosts[G]?.frame).toEqual({ seq: 1, jpegBase64: 'img1' });
    expect(s.lines.find((l) => l.id === '3.2')?.evidence).toEqual({ ghostId: G, frame: 'frames/3.2__doppelganger__r1__a/00001.jpg' });
  });

  it('skips a frame with no data', () => {
    expect(stateAt(tl, 1000, () => undefined).ghosts[G]?.frame).toBeUndefined();
  });
});

describe('estimateFrameTimes', () => {
  it('spreads a ghost\'s frames evenly between its spawn and its rep\'s end', () => {
    expect(estimateFrameTimes(events, [{ ghostId: G, seq: 1 }, { ghostId: G, seq: 0 }])).toEqual([
      { ghostId: G, seq: 0, t: 1200 },
      { ghostId: G, seq: 1, t: 1300 },
    ]);
  });

  it('ends at the last event when the rep never finished, and drops unknown ghosts', () => {
    const cut = events.slice(0, 3).concat([{ type: 'ghost.step', t: 1400, ghostId: G, index: 0, step: 'goto', outcome: 'ok' } as SummonEvent]);
    expect(estimateFrameTimes(cut, [{ ghostId: G, seq: 0 }, { ghostId: 'x', seq: 0 }])).toEqual([{ ghostId: G, seq: 0, t: 1250 }]);
  });
});

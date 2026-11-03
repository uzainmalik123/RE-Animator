import { describe, expect, it } from 'vitest';
import { publicEvent } from '../../src/recording/public.js';
import type { SummonEvent } from '../../src/summon/types.js';

describe('publicEvent', () => {
  it('hides local paths in run.started', () => {
    const e: SummonEvent = { type: 'run.started', t: 1, runId: 'r', runDir: '/home/x/proj/.poltergeist/runs/r', specDir: '/home/x/proj/.kiro/specs/claims', target: 'http://127.0.0.1:4000', criteria: ['3.2'], personas: ['wraith'], reps: 1 };
    expect(publicEvent(e)).toEqual({ ...e, runDir: '.', specDir: 'claims' });
  });

  it('returns other events unchanged', () => {
    const e = { type: 'rep.started', t: 1, rep: 1 } as unknown as SummonEvent;
    expect(publicEvent(e)).toBe(e);
  });
});

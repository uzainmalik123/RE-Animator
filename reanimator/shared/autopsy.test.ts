import { describe, expect, it } from 'vitest';
import { autopsyMarkdown, isAutopsy, type Autopsy } from './autopsy.js';
import { IDLE, reduceRitual } from './ritual.js';

const autopsy: Autopsy = {
  diedAt: 'build',
  symptom: 'util.print is not a function',
  skipped: 0,
  causes: [
    {
      kind: 'removed-api',
      title: 'Removed Node API: util.print',
      why: 'util.print was removed from Node.',
      file: 'build.js',
      lines: [
        { op: ' ', text: "const util = require('util');" },
        { op: '-', text: "util.print('built');" },
        { op: '+', text: "process.stdout.write('built');" },
      ],
      truncated: false,
      seen: true,
    },
  ],
};

describe('reduceRitual (R8)', () => {
  it('keeps the autopsy after the remedy and clears it when a new ritual starts', () => {
    const s = reduceRitual({ ...IDLE, status: 'raising' }, { type: 'autopsy', autopsy });
    expect(s.autopsy).toEqual(autopsy);
    expect(s.status).toBe('raising');
    expect(reduceRitual(s, { type: 'started', repo: 'y', diedIn: 2015 }).autopsy).toBeNull();
    expect(IDLE.autopsy).toBeNull();
  });
});

describe('isAutopsy', () => {
  it('accepts a full autopsy and an empty one', () => {
    expect(isAutopsy(autopsy)).toBe(true);
    expect(isAutopsy({ ...autopsy, diedAt: null, causes: [] })).toBe(true);
  });

  it('rejects a missing causes list, a bad op, a non-string file and a bad vital', () => {
    expect(isAutopsy({ ...autopsy, causes: undefined })).toBe(false);
    expect(isAutopsy({ ...autopsy, causes: [{ ...autopsy.causes[0]!, lines: [{ op: '*', text: 'x' }] }] })).toBe(false);
    expect(isAutopsy({ ...autopsy, causes: [{ ...autopsy.causes[0], file: 3 }] })).toBe(false);
    expect(isAutopsy({ ...autopsy, diedAt: 'sleep' })).toBe(false);
    expect(isAutopsy(null)).toBe(false);
  });
});

describe('autopsyMarkdown', () => {
  it('names the vital, the symptom, each cause and a fenced diff', () => {
    const md = autopsyMarkdown('sundial-2015', autopsy);
    expect(md).toContain('sundial-2015');
    expect(md).toContain('Died at build: util.print is not a function');
    expect(md).toContain('Removed Node API: util.print');
    expect(md).toContain('`build.js`');
    expect(md).toContain("-util.print('built');");
    expect(md).toContain("+process.stdout.write('built');");
    expect(md).toContain('```diff');
  });

  it('says the body keeps its secret when nothing changed', () => {
    expect(autopsyMarkdown(null, { ...autopsy, causes: [] })).toContain('keeps its secret');
  });

  it('uses a longer fence when the evidence contains one', () => {
    const md = autopsyMarkdown('x', { ...autopsy, causes: [{ ...autopsy.causes[0]!, lines: [{ op: '+', text: '```' }] }] });
    expect(md).toContain('````diff');
  });
});

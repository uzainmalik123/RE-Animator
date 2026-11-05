import { describe, expect, it } from 'vitest';
import type { Wound } from './attack.js';
import { healBrief } from './heal.js';

const W: Wound = {
  criterion: '1.2', text: 'THE Guestbook SHALL record only one entry.', persona: 'wraith', reason: 'two entries after a double click',
  steps: ['fill name', 'B: fill name'], expected: ['the list shows one entry'], failing: [], artifacts: [], carried: false,
};

describe('healBrief', () => {
  it('states the criterion, the persona, the steps and the expectation, in plain QA words', () => {
    const b = healBrief(W, '/tmp/r/revived');
    expect(b.split('\n')[0]).toBe('Fix acceptance criterion 1.2 in the app at /tmp/r/revived: "THE Guestbook SHALL record only one entry."');
    expect(b).toContain('It fails for the wraith test persona: two entries after a double click');
    expect(b).toContain('Steps:\n- fill name\n- B: fill name');
    expect(b).toContain('Expected:\n- the list shows one entry');
    expect(b).not.toContain('Failing:');
    expect(b).toContain('The full report is .kiro/specs/chart/haunting-report.md. Do not edit .kiro/specs/chart/requirements.md.');
    expect(b).not.toMatch(/death|wound|ghost|haunt(?!ing-report)/i);
  });
});

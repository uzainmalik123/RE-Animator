// The heal brief (R5, D-R20): a wound as a prompt for Kiro, in plain QA words (no theme words, like
// Poltergeist D-09). Reanimator never drives Kiro; the user copies this into it.
import type { Wound } from './attack.js';

const section = (title: string, lines: string[]) => (lines.length > 0 ? [`${title}:`, ...lines.map((l) => `- ${l}`)] : []);

export function healBrief(w: Wound, body: string): string {
  return [
    `Fix acceptance criterion ${w.criterion} in the app at ${body}: "${w.text}"`,
    `It fails for the ${w.persona} test persona: ${w.reason}`,
    ...section('Steps', w.steps),
    ...section('Expected', w.expected),
    ...section('Failing', w.failing),
    'The full report is .kiro/specs/chart/haunting-report.md. Do not edit .kiro/specs/chart/requirements.md.',
  ].join('\n');
}

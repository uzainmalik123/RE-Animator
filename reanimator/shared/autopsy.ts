// The autopsy (R8, D-R25): why a repo was dead and what was changed to raise it. Computed from the
// real corpse and the real remedy, never written by hand (D-R11); it rides the ritual stream.
import { VITALS, type VitalName } from './ritual.js';

export type CauseKind = 'engine-pin' | 'node-sass' | 'openssl' | 'lockfile' | 'removed-api' | 'other';
export const CAUSE_KINDS: readonly CauseKind[] = ['engine-pin', 'removed-api', 'node-sass', 'openssl', 'lockfile', 'other'];

export interface DiffLine {
  op: '-' | '+' | ' ';
  text: string;
}

export interface Cause {
  kind: CauseKind;
  title: string;
  why: string;
  // Relative to the repo, never absolute.
  file: string;
  lines: DiffLine[];
  truncated: boolean;
  // True when the corpse's real failing output named this cause.
  seen: boolean;
}

export interface Autopsy {
  // The first corpse vital that really failed, or null if none did.
  diedAt: VitalName | null;
  symptom: string;
  causes: Cause[];
  // Files left out of the reading: binary, oversized, or too many causes.
  skipped: number;
}

export const LIMITS = { fileBytes: 65536, lines: 40, lineChars: 200, causes: 12 } as const;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isLine = (v: unknown): v is DiffLine => isObject(v) && (v.op === '-' || v.op === '+' || v.op === ' ') && typeof v.text === 'string';
const isCause = (v: unknown): v is Cause =>
  isObject(v) &&
  CAUSE_KINDS.includes(v.kind as CauseKind) &&
  typeof v.title === 'string' &&
  typeof v.why === 'string' &&
  typeof v.file === 'string' &&
  Array.isArray(v.lines) &&
  v.lines.every(isLine) &&
  typeof v.truncated === 'boolean' &&
  typeof v.seen === 'boolean';

// Shape guard for data that arrives from outside (a recording).
export function isAutopsy(v: unknown): v is Autopsy {
  return (
    isObject(v) &&
    (v.diedAt === null || VITALS.includes(v.diedAt as VitalName)) &&
    typeof v.symptom === 'string' &&
    typeof v.skipped === 'number' &&
    Array.isArray(v.causes) &&
    v.causes.every(isCause)
  );
}

export const headline = (a: Autopsy): string => (a.diedAt ? `Died at ${a.diedAt}: ${a.symptom || 'no output'}` : 'No vital failed on the corpse');

// A Markdown report a human can paste into a PR description (D-R10).
export function autopsyMarkdown(repo: string | null, a: Autopsy): string {
  const out = [`## Autopsy${repo ? `: ${repo}` : ''}`, '', `**${headline(a)}**`, ''];
  if (a.causes.length === 0) out.push('No known cause: the body keeps its secret.', '');
  for (const c of a.causes) {
    out.push(`### ${c.title}`, '', `${c.why} \`${c.file}\`${c.seen ? ' (named in the corpse\'s real failing output)' : ''}`, '');
    if (c.lines.length > 0) {
      const longest = Math.max(0, ...c.lines.map((l) => (l.text.match(/`+/g) ?? []).reduce((m, r) => Math.max(m, r.length), 0)));
      const fence = '`'.repeat(Math.max(3, longest + 1));
      out.push(`${fence}diff`, ...c.lines.map((l) => `${l.op === ' ' ? ' ' : l.op}${l.text}`), fence, '');
    }
    if (c.truncated) out.push('_Evidence truncated._', '');
  }
  return out.join('\n').trimEnd() + '\n';
}

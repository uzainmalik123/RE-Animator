import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PersonaId } from '../personas/registry.js';
import type { Criterion } from '../spec/types.js';
import type { CriterionVerdict, PairVerdict } from '../verdicts/types.js';
import { ReportJsonSchema, type ReportJson } from './schema.js';
import { REPORT_FILES } from './write.js';

export type ReportVerdict = CriterionVerdict | 'notRun';

/** How one re-run criterion moved since the previous report (F14, D-42). */
export type VerdictChange = {
  id: string;
  from: ReportVerdict;
  to: ReportVerdict;
  /** Personas that ran this time and whose verdict changed. */
  personas: { persona: PersonaId; from: PairVerdict; to: PairVerdict }[];
};

type Row = ReportJson['criteria'][number];

/** The spec's last `haunting-report.json`; missing, unreadable or another version is none, never an error. */
export async function readReportJson(specDir: string): Promise<ReportJson | undefined> {
  try {
    const parsed = ReportJsonSchema.safeParse(JSON.parse(await readFile(join(specDir, REPORT_FILES.json), 'utf8')));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The previous report's row for a criterion, only while it still describes the same promise
 * against the same app: same target, same id, same text.
 */
export function usableRow(previous: ReportJson | undefined, target: string, c: Pick<Criterion, 'id' | 'text'>): Row | undefined {
  if (previous?.target !== target) return undefined;
  const row = previous.criteria.find((r) => r.id === c.id);
  return row?.text === c.text ? row : undefined;
}

/** Pure: every criterion that ran in `current` and changed since `previous`, in spec order. */
export function diffVerdicts(previous: ReportJson | undefined, current: ReportJson): VerdictChange[] {
  const changes: VerdictChange[] = [];
  for (const row of current.criteria) {
    if (row.carriedFrom !== undefined || row.verdict === 'notRun') continue;
    const before = usableRow(previous, current.target, row);
    if (!before || before.verdict === 'notRun') continue;
    const personas = row.pairs.flatMap((p) => {
      const was = p.carriedFrom === undefined ? before.pairs.find((b) => b.persona === p.persona) : undefined;
      return was && was.verdict !== p.verdict ? [{ persona: p.persona, from: was.verdict, to: p.verdict }] : [];
    });
    if (before.verdict !== row.verdict || personas.length > 0) changes.push({ id: row.id, from: before.verdict, to: row.verdict, personas });
  }
  return changes;
}

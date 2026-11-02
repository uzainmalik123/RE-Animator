import { relative } from 'node:path';
import { DRAFT_WORDMARK, VERDICT_GLYPHS, type PairVerdict, type SummonResult } from '@poltergeist/core';
import { paint, termSafe, type Tone } from './color.js';

const TONE: Record<PairVerdict | 'notRun', Tone> = {
  haunted: 'haunted',
  flaky: 'flaky',
  inconclusive: 'unsure',
  uncompilable: 'unsure',
  clean: 'ink',
  notApplicable: 'dim',
  notRun: 'dim',
};

/** The wordmark (draft until F26, KI-40) and a one-line summary (THEME §5). */
export function renderHeader(o: { specDir: string; target: string; criteria: number; personas: number; reps: number }, color: boolean): string {
  const mark = DRAFT_WORDMARK.split('\n').map((l) => paint(l, 'ink', color)).join('\n');
  const summary = `haunting ${o.criteria} criteria × ${o.personas} personas × ${o.reps} reps → ${termSafe(o.target, 80)}`;
  return `${mark}\n\n${summary}\n${paint(`spec: ${termSafe(o.specDir, 120)}`, 'dim', color)}\n`;
}

/** The final board: one row per selected criterion with its verdict glyph, then pair counts and the report path. */
export function renderBoard(r: SummonResult, opts: { color: boolean; width: number; cwd?: string }): string {
  const { color, width } = opts;
  const verdictOf = new Map(r.merged.map((c) => [c.id, c.verdict]));
  const rows = r.criteria.map((c) => {
    const verdict = verdictOf.get(c.id) ?? 'notRun';
    const head = `${VERDICT_GLYPHS[verdict]} ${c.id}  `;
    return paint(VERDICT_GLYPHS[verdict], TONE[verdict], color) + head.slice(4) + termSafe(c.text, width - head.length);
  });
  const n = r.verdicts.counts;
  const counts = `haunted ${n.haunted} · flaky ${n.flaky} · inconclusive ${n.inconclusive + n.uncompilable} · clean ${n.clean} · n/a ${n.notApplicable}`;
  const report = `report: ${relative(opts.cwd ?? process.cwd(), r.reportPaths.markdownPath)}`;
  // F14 (D-42): `3.2 [!!] → [ok]` for each re-run criterion whose verdict moved.
  const glyph = (v: PairVerdict | 'notRun') => paint(VERDICT_GLYPHS[v], TONE[v], color);
  const moved = r.changes.filter((c) => c.from !== c.to);
  const changes = moved.length
    ? ['', termSafe(`changes since ${r.previousRunId ?? 'the last run'}:`, width), ...moved.map((c) => `  ${termSafe(c.id, 20)} ${glyph(c.from)} → ${glyph(c.to)}`)]
    : [];
  return [...rows, ...changes, '', termSafe(counts, width), paint(termSafe(report, width), 'dim', color), ''].join('\n');
}

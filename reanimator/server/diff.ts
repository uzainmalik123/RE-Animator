// A small line diff for the autopsy (R8). Inputs are capped by the caller (files <= 64 KB), so the
// O(n*m) LCS table is fine and keeps the result minimal and deterministic.
import type { DiffLine } from '../shared/autopsy.js';

// Above this many LCS cells (about 2000 x 2000 lines) the middle is shown as one block removed and
// one added: a stranger's file must not be able to cost gigabytes (R9).
export const MAX_CELLS = 4_000_000;

// The edit script from `a` to `b`, reduced to the changed lines plus `context` lines around them.
export function diffLines(a: string[], b: string[], context = 1): DiffLine[] {
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
  const script = [
    ...a.slice(0, head).map((text): DiffLine => ({ op: ' ', text })),
    ...editScript(a.slice(head, a.length - tail), b.slice(head, b.length - tail)),
    ...a.slice(a.length - tail).map((text): DiffLine => ({ op: ' ', text })),
  ];
  return hunks(script, context);
}

function editScript(a: string[], b: string[]): DiffLine[] {
  const n = a.length;
  const m = b.length;
  if ((n + 1) * (m + 1) > MAX_CELLS) return [...a.map((text): DiffLine => ({ op: '-', text })), ...b.map((text): DiffLine => ({ op: '+', text }))];
  // lcs[i][j] = length of the longest common subsequence of a[i..] and b[j..]
  const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);

  const script: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      script.push({ op: ' ', text: a[i]! });
      i++;
      j++;
    } else if (i < n && (j === m || lcs[i + 1]![j]! >= lcs[i]![j + 1]!)) script.push({ op: '-', text: a[i++]! });
    else script.push({ op: '+', text: b[j++]! });
  }

  return script;
}

function hunks(script: DiffLine[], context: number): DiffLine[] {
  const keep = new Array<boolean>(script.length).fill(false);
  script.forEach((l, k) => {
    if (l.op === ' ') return;
    const from = Number.isFinite(context) ? Math.max(0, k - context) : 0;
    const to = Number.isFinite(context) ? Math.min(script.length - 1, k + context) : script.length - 1;
    for (let x = from; x <= to; x++) keep[x] = true;
  });
  return script.filter((_, k) => keep[k]);
}

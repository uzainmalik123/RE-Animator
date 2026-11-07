// A small line diff for the autopsy (R8). Inputs are capped by the caller (files <= 64 KB), so the
// O(n*m) LCS table is fine and keeps the result minimal and deterministic.
import type { DiffLine } from '../shared/autopsy.js';

// The edit script from `a` to `b`, reduced to the changed lines plus `context` lines around them.
export function diffLines(a: string[], b: string[], context = 1): DiffLine[] {
  const n = a.length;
  const m = b.length;
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

  const keep = new Array<boolean>(script.length).fill(false);
  script.forEach((l, k) => {
    if (l.op === ' ') return;
    const from = Number.isFinite(context) ? Math.max(0, k - context) : 0;
    const to = Number.isFinite(context) ? Math.min(script.length - 1, k + context) : script.length - 1;
    for (let x = from; x <= to; x++) keep[x] = true;
  });
  return script.filter((_, k) => keep[k]);
}

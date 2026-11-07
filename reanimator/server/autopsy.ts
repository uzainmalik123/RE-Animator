// The autopsy (R8, D-R25): compare the untouched corpse with the body after the remedy and name what
// changed. Deterministic and computed only from the two trees and the corpse's real failing output
// (D-R11): a cause that is not in the diff is never shown. Both trees may be a stranger's repo (R9),
// so nothing here follows a symlink or reads anything big (see own-file.ts, D-R23).
import { lstat, readdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { CAUSE_KINDS, LIMITS, type Autopsy, type Cause, type CauseKind, type DiffLine } from '../shared/autopsy.js';
import type { VitalName } from '../shared/ritual.js';
import { diffLines } from './diff.js';
import { readOwn } from './own-file.js';

// Node APIs that are really gone on Node 22. Deprecated-but-present ones are not listed: calling
// them removed would be false (D-R11).
export const REMOVED_APIS: readonly { name: string; token: RegExp }[] = [
  { name: 'util.puts', token: /\butil\.puts\b/ },
  { name: 'util.print', token: /\butil\.print\b/ },
  { name: 'util.pump', token: /\butil\.pump\b/ },
  { name: 'util.error', token: /\butil\.error\b/ },
  { name: 'util.debug', token: /\butil\.debug\b/ },
  { name: 'sys.puts', token: /\bsys\.puts\b/ },
  { name: 'process.EventEmitter', token: /\bprocess\.EventEmitter\b/ },
  { name: 'os.tmpDir', token: /\bos\.tmpDir\b/ },
];

const MAX_FILES = 2000;
const IGNORED_DIRS = new Set(['node_modules', '.git']);
const LOCKFILES = new Set(['package-lock.json', 'npm-shrinkwrap.json']);
const DEP_FIELDS = new Set(['dependencies', 'devDependencies', 'optionalDependencies']);

// What each kind of death was, in plain words (what the necromancer reads).
const ABOUT: Record<CauseKind, { title: string; why: string; seen: RegExp | null }> = {
  'engine-pin': {
    title: 'Pinned to an old Node',
    why: 'The repo declared an old Node. With strict engines npm refuses to install on a newer one; either way the declaration was moved or dropped.',
    seen: /EBADENGINE|Unsupported engine/i,
  },
  'removed-api': { title: 'Removed Node API', why: 'Node removed this API, so the code throws on Node 22. It was rewritten with its replacement.', seen: null },
  'node-sass': {
    title: 'Native node-sass',
    why: 'node-sass is a native addon that no longer builds on Node 22. It was replaced by the pure-JS sass.',
    seen: /node-sass|node-gyp/i,
  },
  openssl: {
    title: 'Old webpack on a new OpenSSL',
    why: 'Webpack 4 and older hash with an OpenSSL algorithm Node 22 refuses. The legacy provider was switched on.',
    seen: /ERR_OSSL|openssl/i,
  },
  lockfile: {
    title: 'An ancient lockfile',
    why: 'A version 1 lockfile pins a dependency tree from another era. It was dropped and peer dependencies relaxed.',
    seen: /ERESOLVE|lockfile/i,
  },
  other: { title: 'Changed', why: 'This file differs between the corpse and the raised body.', seen: null },
};

// The first line that looks like the failure, else the first line at all.
function symptom(detail: string): string {
  const lines = detail.split('\n').map((l) => l.trim()).filter((l) => l !== '');
  const line = lines.find((l) => /error|ERR!|EBADENGINE|not a function|not a constructor/i.test(l)) ?? lines[0] ?? '';
  return line.slice(0, LIMITS.lineChars);
}

type Read = { text: string } | { skip: true } | null;

async function readText(path: string): Promise<Read> {
  const s = await lstat(path).catch(() => null);
  if (!s) return null;
  if (!s.isFile() || s.size > LIMITS.fileBytes) return { skip: true };
  const text = await readOwn(path);
  if (text === null || text.includes('\0')) return { skip: true };
  return { text };
}

// Relative paths under `root`, symlinks and other oddities included (readText refuses them, so they
// are counted as skipped once and never followed).
async function walk(root: string): Promise<string[]> {
  const out: string[] = [];
  const visit = async (rel: string): Promise<void> => {
    if (out.length >= MAX_FILES) return;
    const entries = await readdir(join(root, rel), { withFileTypes: true }).catch(() => []);
    for (const e of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const next = rel === '' ? e.name : `${rel}/${e.name}`;
      if (e.isDirectory()) {
        if (!IGNORED_DIRS.has(e.name)) await visit(next);
      } else out.push(next);
    }
  };
  await visit('');
  return out;
}

const split = (s: string): string[] => (s === '' ? [] : s.replace(/\n$/, '').split('\n'));
const row = (op: DiffLine['op'], text: string): DiffLine => ({ op, text });

// One cause: evidence capped to the limits, truncation reported.
function cause(kind: CauseKind, file: string, lines: DiffLine[], detail: string, over?: { title?: string; names?: string[] }): Cause {
  const about = ABOUT[kind];
  let truncated = lines.length > LIMITS.lines;
  const capped = lines.slice(0, LIMITS.lines).map((l) => {
    if (l.text.length <= LIMITS.lineChars) return l;
    truncated = true;
    return { ...l, text: l.text.slice(0, LIMITS.lineChars - 1) + '…' };
  });
  const names = over?.names ?? [];
  const seen = kind === 'removed-api' ? names.some((n) => detail.includes(n)) : about.seen !== null && about.seen.test(detail);
  return { kind, title: over?.title ?? about.title, why: about.why, file, lines: capped, truncated, seen };
}

const compact = (v: unknown): string => JSON.stringify(v);

// package.json compared by parsed field, so a reformat is not a change and each field is its own cause.
function packageCauses(before: unknown, after: unknown, detail: string): Cause[] | null {
  const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
  if (!isObj(before) || !isObj(after)) return null;
  const causes: Cause[] = [];
  for (const key of [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()) {
    if (compact(before[key]) === compact(after[key])) continue;
    const b = before[key];
    const a = after[key];
    if (DEP_FIELDS.has(key) && isObj(b ?? {}) && isObj(a ?? {})) {
      const bd = (b ?? {}) as Record<string, unknown>;
      const ad = (a ?? {}) as Record<string, unknown>;
      const lines: DiffLine[] = [];
      for (const dep of [...new Set([...Object.keys(bd), ...Object.keys(ad)])].sort()) {
        if (compact(bd[dep]) === compact(ad[dep])) continue;
        if (dep in bd) lines.push(row('-', `${compact(dep)}: ${compact(bd[dep])}`));
        if (dep in ad) lines.push(row('+', `${compact(dep)}: ${compact(ad[dep])}`));
      }
      const sass = 'node-sass' in bd && !('node-sass' in ad);
      causes.push(cause(sass ? 'node-sass' : 'other', 'package.json', lines, detail, sass ? undefined : { title: `Changed: ${key}` }));
      continue;
    }
    const lines: DiffLine[] = [];
    if (key in before) lines.push(row('-', `${compact(key)}: ${compact(b)}`));
    if (key in after) lines.push(row('+', `${compact(key)}: ${compact(a)}`));
    causes.push(key === 'engines' ? cause('engine-pin', 'package.json', lines, detail) : cause('other', 'package.json', lines, detail, { title: `Changed: ${key}` }));
  }
  return causes;
}

function fileCause(file: string, lines: DiffLine[], detail: string): Cause {
  const removed = lines.filter((l) => l.op === '-').map((l) => l.text);
  const added = lines.filter((l) => l.op === '+').map((l) => l.text);
  if (basename(file) === '.npmrc') {
    if (removed.some((l) => /engine-strict/.test(l))) return cause('engine-pin', file, lines, detail, { title: 'Strict engines' });
    if (added.some((l) => /openssl-legacy-provider/.test(l))) return cause('openssl', file, lines, detail);
    if (added.some((l) => /legacy-peer-deps/.test(l))) return cause('lockfile', file, lines, detail);
    return cause('other', file, lines, detail, { title: `Changed: ${file}` });
  }
  const names = REMOVED_APIS.filter((api) => removed.some((l) => api.token.test(l))).map((api) => api.name);
  if (names.length > 0) {
    return cause('removed-api', file, lines, detail, { names, title: `${names.length === 1 ? 'Removed Node API' : 'Removed Node APIs'}: ${names.join(', ')}` });
  }
  return cause('other', file, lines, detail, { title: `Changed: ${file}` });
}

export async function buildAutopsy(corpse: string, revived: string, failure: { vital: VitalName; detail: string } | null): Promise<Autopsy> {
  const detail = failure?.detail ?? '';
  const files = [...new Set([...(await walk(corpse)), ...(await walk(revived))])].sort();
  const causes: Cause[] = [];
  let skipped = 0;

  for (const file of files) {
    const [a, b] = await Promise.all([readText(join(corpse, file)), readText(join(revived, file))]);
    if ((a && 'skip' in a) || (b && 'skip' in b)) {
      skipped++;
      continue;
    }
    const before = a?.text ?? null;
    const after = b?.text ?? null;
    if (before === after) continue;
    if (LOCKFILES.has(basename(file))) {
      causes.push(cause('lockfile', file, [], detail));
      continue;
    }
    if (basename(file) === 'package.json' && before !== null && after !== null) {
      try {
        const found = packageCauses(JSON.parse(before), JSON.parse(after), detail);
        if (found) {
          causes.push(...found);
          continue;
        }
      } catch {
        // Not JSON: it falls through to a plain diff below.
      }
    }
    const lines = diffLines(split(before ?? ''), split(after ?? ''));
    if (lines.length > 0) causes.push(fileCause(file, lines, detail));
  }

  const order = (c: Cause) => CAUSE_KINDS.indexOf(c.kind);
  causes.sort((x, y) => order(x) - order(y) || (x.file < y.file ? -1 : x.file > y.file ? 1 : 0));
  skipped += Math.max(0, causes.length - LIMITS.causes);
  return { diedAt: failure?.vital ?? null, symptom: symptom(detail), causes: causes.slice(0, LIMITS.causes), skipped };
}

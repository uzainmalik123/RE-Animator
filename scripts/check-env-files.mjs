#!/usr/bin/env node
// The secrets guard (repo-wide, CI job `env-files`, required on main with no bypass). Fails when a
// committed env file holds a real value: a secret-named variable with a value in a `.env.example`
// (commented-out lines too), a token-shaped string anywhere in one, or a real `.env` committed at all.
// Run: node scripts/check-env-files.mjs   (exits 1 and names each file:line, never the value)
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

// Committed env files may only be templates or the replay build's public flags.
const ALLOWED_NAMES = /^\.env\.(example|replay)$|\.env\.example$/;
const SECRET_NAME = /KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|PRIVATE|AUTH/i;
// A value a template may show: empty, or a <placeholder>.
const PLACEHOLDER = /^(<[^>]*>)?$/;
const TOKEN_SHAPES = [
  ['Anthropic key', /sk-ant-[A-Za-z0-9_-]{10,}/],
  ['OpenAI-style key', /\bsk-(proj-)?[A-Za-z0-9_-]{20,}/],
  ['Google API key', /AIza[0-9A-Za-z_-]{30,}/],
  ['Groq key', /\bgsk_[A-Za-z0-9]{20,}/],
  ['AWS access key id', /\b(AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['Bedrock API key', /\bABSK[A-Za-z0-9+/=]{20,}/],
  ['E2B key', /\be2b_[A-Za-z0-9]{20,}/],
  ['GitHub token', /\b(ghp|gho|ghs|ghu|ghr)_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}/],
  ['Doppler token', /\bdp\.(st|pt|sa|ct)\.[A-Za-z0-9_.-]{20,}/],
  ['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
];

const ASSIGN = /^\s*#?\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/;

function valueOf(raw) {
  let v = raw;
  const q = v[0];
  if ((q === '"' || q === "'") && v.lastIndexOf(q) > 0) v = v.slice(1, v.lastIndexOf(q));
  else v = v.replace(/\s+#.*$/, '');
  return v.trim();
}

/** Problems in one env file's text, as `line N: why` (never the value itself). */
export function checkEnvText(text) {
  const problems = [];
  text.split(/\r?\n/).forEach((line, i) => {
    const n = i + 1;
    for (const [what, shape] of TOKEN_SHAPES) if (shape.test(line)) problems.push(`line ${n}: looks like a real ${what}`);
    const m = ASSIGN.exec(line);
    if (m && SECRET_NAME.test(m[1]) && !PLACEHOLDER.test(valueOf(m[2]))) problems.push(`line ${n}: ${m[1]} has a value; leave it empty (put real keys in .env)`);
  });
  return [...new Set(problems)];
}

/** Problems across the given repo paths: committed real env files, and filled-in templates. */
export function checkFiles(paths, read = (p) => readFileSync(p, 'utf8')) {
  const out = [];
  for (const p of paths) {
    const name = basename(p);
    if (!/^\.env($|\.)|\.env$|\.env\./.test(name)) continue;
    if (!ALLOWED_NAMES.test(name)) {
      out.push(`${p}: a real env file is committed; remove it (git rm --cached) and rotate every key in it`);
      continue;
    }
    for (const problem of checkEnvText(read(p))) out.push(`${p} ${problem}`);
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  const problems = checkFiles(files);
  if (problems.length) {
    console.error('Secrets guard: committed env files must not hold real values.\n');
    for (const p of problems) console.error(`  ✗ ${p}`);
    console.error('\nMove the value to your own .env (gitignored). If a real key was pushed, rotate it: it is in git history.');
    process.exit(1);
  }
  console.log(`Secrets guard: ${files.filter((f) => /\.env/.test(basename(f))).length} env file(s) clean.`);
}

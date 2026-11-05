// A dead repo to raise. Prepared (D-R6, D-R14): fixtures/<name>/ holds manifest.json, corpse/ (the
// untouched dead repo) and remedy/ (files laid over a copy of the corpse to revive it). A grave
// (R9, D-R23) is cloned instead, its remedy is the rites, and it runs in a sandbox.
import { stat, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Sandbox } from './sandbox.js';

export interface Fixture {
  name: string;
  diedIn: number;
  licence: string;
  // The serve argv; null = infer it from the body (serve.ts).
  serve: string[] | null;
  dir: string;
  corpseDir: string;
  remedyDir?: string;
  // Revives a copy of the corpse in place; without it, remedyDir is laid over the copy.
  remedy?: (revivedDir: string) => Promise<{ files: number; rites?: string[] }>;
  // Every command of the body runs in it (a stranger's repo); none for our own fixtures.
  sandbox?: Sandbox;
  // chart/ (requirements.md + routes.json): the spec Death tests the revived app against (D-R8, R3).
  chartDir: string | null;
}

// Our own practice corpse; the real demo repo (KI-R1) drops in beside it.
export const PRACTICE_CORPSE = fileURLToPath(new URL('../fixtures/practice-corpse', import.meta.url));

async function isDir(p: string): Promise<boolean> {
  return stat(p).then((s) => s.isDirectory(), () => false);
}

export async function loadFixture(dir: string): Promise<Fixture> {
  const raw: unknown = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8'));
  const m = (raw ?? {}) as Record<string, unknown>;
  const bad = (field: string, want: string) => new Error(`fixture ${dir}: manifest "${field}" must be ${want}`);
  if (typeof m.name !== 'string' || m.name === '') throw bad('name', 'a non-empty string');
  if (typeof m.diedIn !== 'number' || !Number.isInteger(m.diedIn)) throw bad('diedIn', 'an integer year');
  if (typeof m.licence !== 'string') throw bad('licence', 'a string');
  if (!Array.isArray(m.serve) || m.serve.length === 0 || !m.serve.every((a) => typeof a === 'string' && a !== '')) {
    throw bad('serve', 'a non-empty array of strings (argv)');
  }
  const corpseDir = join(dir, 'corpse');
  const remedyDir = join(dir, 'remedy');
  if (!(await isDir(corpseDir))) throw new Error(`fixture ${dir}: missing corpse/ folder`);
  if (!(await isDir(remedyDir))) throw new Error(`fixture ${dir}: missing remedy/ folder`);
  const chartDir = join(dir, 'chart');
  const hasChart = await stat(join(chartDir, 'requirements.md')).then((s) => s.isFile(), () => false);
  return { name: m.name, diedIn: m.diedIn, licence: m.licence, serve: m.serve as string[], dir, corpseDir, remedyDir, chartDir: hasChart ? chartDir : null };
}

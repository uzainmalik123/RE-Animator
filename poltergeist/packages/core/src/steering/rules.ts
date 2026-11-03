import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ForbiddenSchema, type ForbiddenRule } from '../config/schema.js';
import { isPersonaId, type PersonaId } from '../personas/registry.js';

/** Where `poltergeist init` writes the steering file, relative to the config's folder (D-41). */
export const STEERING_FILE = '.kiro/steering/poltergeist.md';
export const MAX_NOTE_LENGTH = 500;

export type RouteNote = { path: string; text: string };

/** The `## House rules` of a target's steering file (F17, D-45). Every field only tightens the config. */
export type HouseRules = {
  /** The steering file read, or null when there is none. */
  path: string | null;
  disabled: PersonaId[];
  forbidden: ForbiddenRule[];
  notes: RouteNote[];
};

export type HouseRulesResult = { rules: HouseRules; warnings: string[] };

const HEADING = /^##\s+house rules\s*$/i;
const RULE = /^-\s+(\w+)(?:\s+(\S+))?\s*:\s*(.*)$/;

/** Comments become blank lines with the same line breaks, so line numbers still match the file. */
const stripComments = (md: string) => md.replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, ''));

/**
 * Parses the `## House rules` section (up to the next `## ` heading). Only `- ` lines are rules:
 * `- disable: <ids>`, `- forbid: <METHOD|*> <path>`, `- note <path>: <text>`. A bad line is a
 * warning and is skipped; parsing never throws.
 */
export function parseHouseRules(markdown: string, path: string): HouseRulesResult {
  const rules: HouseRules = { path, disabled: [], forbidden: [], notes: [] };
  const warnings: string[] = [];
  const notes = new Map<string, string>();
  const lines = stripComments(markdown).split(/\r?\n/);
  const start = lines.findIndex((l) => HEADING.test(l.trim()));
  if (start === -1) return { rules, warnings };

  for (let i = start + 1; i < lines.length; i++) {
    const line = (lines[i] as string).trim();
    if (/^##?\s/.test(line)) break;
    if (!line.startsWith('- ')) continue;
    const warn = (message: string) => warnings.push(`house rules line ${i + 1}: ${message}`);
    const m = RULE.exec(line);
    if (!m) {
      warn(`cannot read "${line}"; expected "- key: value"`);
      continue;
    }
    const [, rawKey, arg, rawValue] = m as unknown as [string, string, string | undefined, string];
    const key = rawKey.toLowerCase();
    const value = rawValue.trim();
    if (key === 'note') {
      if (arg === undefined || !arg.startsWith('/')) warn('note needs a path starting with "/": "- note /path: text"');
      else if (value.length === 0 || value.length > MAX_NOTE_LENGTH) warn(`note text must be 1–${MAX_NOTE_LENGTH} characters`);
      else notes.set(arg, notes.has(arg) ? `${notes.get(arg)} ${value}` : value);
      continue;
    }
    if (arg !== undefined) {
      warn(`unknown house rule "${rawKey} ${arg}"`);
      continue;
    }
    if (key === 'disable') {
      for (const id of value.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)) {
        if (!isPersonaId(id)) warn(`unknown persona "${id}"`);
        else if (!rules.disabled.includes(id)) rules.disabled.push(id);
      }
    } else if (key === 'forbid') {
      const [method, rulePath, ...rest] = value.split(/\s+/);
      const parsed = ForbiddenSchema.safeParse({ method: method?.toUpperCase(), path: rulePath });
      if (!parsed.success || rest.length > 0) warn(`forbid needs "<METHOD|*> /path", got "${value}"`);
      else rules.forbidden.push(parsed.data);
    } else {
      warn(`unknown house rule "${rawKey}" (known: disable, forbid, note)`);
    }
  }
  rules.notes = [...notes].map(([p, text]) => ({ path: p, text }));
  return { rules, warnings };
}

const EMPTY: HouseRules = { path: null, disabled: [], forbidden: [], notes: [] };

/** Reads `<configDir>/.kiro/steering/poltergeist.md`. No file means no rules; a read error is a warning. */
export async function readHouseRules(configDir: string): Promise<HouseRulesResult> {
  const file = join(configDir, STEERING_FILE);
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch (cause) {
    const code = (cause as NodeJS.ErrnoException).code ?? 'unknown error';
    if (code === 'ENOENT') return { rules: { ...EMPTY }, warnings: [] };
    return { rules: { ...EMPTY }, warnings: [`house rules: cannot read ${file}: ${code}; no house rules applied`] };
  }
  return parseHouseRules(text, file);
}

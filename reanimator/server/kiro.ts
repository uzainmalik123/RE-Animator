// Running the Kiro agent headless (R7, D-R21): one `kiro-cli chat` turn per spell, in the revived
// body, with file tools only. Its stdout is the run's ACP events as JSON Lines; they are read
// leniently (the live envelope is unverified, KI-R21) into the grimoire's spell events.
import type { SpellEvent } from '../shared/grimoire.js';
import { runCommand } from './exec.js';

export const SPELL_TIMEOUT_MS = 600_000;
export const DEFAULT_KIRO = 'kiro-cli';

// The spell goes last, after `--`, so a spell that starts with `-` is never read as a flag.
export function kiroArgv(cli: string, text: string, resume: boolean): string[] {
  return [cli, 'chat', '--no-interactive', '--output-format', 'stream-json', '--trust-tools=fs_read,fs_write', ...(resume ? ['--resume'] : []), '--', text];
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

// The session update in a line: a JSON-RPC `session/update` notification's params.update, a bare
// {update}, or the update itself.
function updateOf(raw: Obj): Obj | null {
  if (isObj(raw.params) && isObj(raw.params.update)) return raw.params.update;
  if (isObj(raw.update)) return raw.update;
  return typeof raw.sessionUpdate === 'string' ? raw : null;
}

export function toSpellEvents(raw: unknown): SpellEvent[] {
  if (!isObj(raw)) return [];
  const stopReason = str(isObj(raw.result) ? raw.result.stopReason : undefined) ?? str(raw.stopReason);
  if (stopReason) return [{ type: 'sealed', stopReason }];
  const u = updateOf(raw);
  if (!u) return [];
  switch (u.sessionUpdate) {
    case 'agent_message_chunk': {
      const c = u.content;
      return isObj(c) && c.type === 'text' && typeof c.text === 'string' ? [{ type: 'quill', text: c.text }] : [];
    }
    case 'tool_call':
    case 'tool_call_update': {
      const id = str(u.toolCallId);
      if (!id) return [];
      const fresh = u.sessionUpdate === 'tool_call';
      const title = str(u.title) ?? (fresh ? (str(u.kind) ?? 'tool') : '');
      const out: SpellEvent[] = [{ type: 'margin', id, title, status: str(u.status) ?? 'pending' }];
      for (const c of Array.isArray(u.content) ? u.content : []) {
        if (isObj(c) && c.type === 'diff' && typeof c.path === 'string' && typeof c.newText === 'string') {
          out.push({ type: 'ruled', path: c.path, oldText: str(c.oldText) ?? '', newText: c.newText });
        }
      }
      return out;
    }
    case 'usage_update':
      return typeof u.used === 'number' && typeof u.size === 'number' ? [{ type: 'candle', used: u.used, size: u.size }] : [];
    default:
      return [];
  }
}

const lastLine = (output: string) =>
  output
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '')
    .at(-1) ?? 'Kiro stopped';

// One turn. Its events go to onEvent as they arrive; the seal is the result, not an event.
export async function runKiro(o: {
  cli: string;
  cwd: string;
  text: string;
  resume: boolean;
  env: NodeJS.ProcessEnv;
  signal?: AbortSignal;
  timeoutMs?: number;
  onEvent: (e: SpellEvent) => void;
}): Promise<{ ok: true; stopReason: string } | { ok: false; error: string }> {
  let partial = '';
  let sealed: string | null = null;
  const line = (l: string) => {
    if (l.trim() === '') return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(l);
    } catch {
      return;
    }
    for (const e of toSpellEvents(parsed)) {
      if (e.type === 'sealed') sealed ??= e.stopReason;
      else o.onEvent(e);
    }
  };
  const onOutput = (text: string) => {
    const lines = (partial + text).split('\n');
    partial = lines.pop() ?? '';
    lines.forEach(line);
  };
  const timeoutMs = o.timeoutMs ?? SPELL_TIMEOUT_MS;
  const r = await runCommand(kiroArgv(o.cli, o.text, o.resume), { cwd: o.cwd, env: o.env, timeoutMs, signal: o.signal, onOutput });
  line(partial);
  if (o.signal?.aborted) return { ok: false, error: 'stopped' };
  if (r.timedOut) return { ok: false, error: `Kiro ran past ${Math.round(timeoutMs / 60_000)} min` };
  if (r.code === 0) return { ok: true, stopReason: sealed ?? 'end_turn' };
  if (/\bENOENT\b/.test(r.output) && r.code === null) return { ok: false, error: 'kiro-cli is not installed (or not on PATH)' };
  return { ok: false, error: lastLine(r.output) };
}

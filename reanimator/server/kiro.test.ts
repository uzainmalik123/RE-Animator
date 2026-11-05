import { chmod, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import type { SpellEvent } from '../shared/grimoire.js';
import { kiroArgv, runKiro, toSpellEvents } from './kiro.js';

const FAKE_KIRO = fileURLToPath(new URL('./fixtures/fake-kiro.mjs', import.meta.url));

beforeAll(() => chmod(FAKE_KIRO, 0o755));

const env = (extra: Record<string, string> = {}) => ({ PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', ...extra });
const update = (u: object) => ({ jsonrpc: '2.0', method: 'session/update', params: { sessionId: 's', update: u } });

describe('kiroArgv', () => {
  it('runs one headless chat turn, fs tools only, the spell last and after --', () => {
    const text = '-x "q"\nnew';
    expect(kiroArgv('k', text, true)).toEqual(['k', 'chat', '--no-interactive', '--output-format', 'stream-json', '--trust-tools=fs_read,fs_write', '--resume', '--', text]);
    expect(kiroArgv('k', 'hi', false)).not.toContain('--resume');
  });
});

describe('toSpellEvents', () => {
  it('reads a message chunk as quill writing, in either envelope', () => {
    const u = { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Hi' } };
    expect(toSpellEvents(update(u))).toEqual([{ type: 'quill', text: 'Hi' }]);
    expect(toSpellEvents(u)).toEqual([{ type: 'quill', text: 'Hi' }]);
    expect(toSpellEvents({ update: u })).toEqual([{ type: 'quill', text: 'Hi' }]);
  });

  it('reads tool calls as margin notes, and their diffs as ruled boxes', () => {
    expect(toSpellEvents(update({ sessionUpdate: 'tool_call', toolCallId: 't1', title: 'Reading server.js', status: 'pending' }))).toEqual([
      { type: 'margin', id: 't1', title: 'Reading server.js', status: 'pending' },
    ]);
    expect(toSpellEvents(update({ sessionUpdate: 'tool_call', toolCallId: 't1', kind: 'read' }))).toEqual([{ type: 'margin', id: 't1', title: 'read', status: 'pending' }]);
    expect(toSpellEvents(update({ sessionUpdate: 'tool_call_update', toolCallId: 't1', status: 'completed' }))).toEqual([{ type: 'margin', id: 't1', title: '', status: 'completed' }]);
    expect(
      toSpellEvents(update({ sessionUpdate: 'tool_call_update', toolCallId: 't2', title: 'Edit', status: 'completed', content: [{ type: 'diff', path: 'a.js', newText: 'x' }, { type: 'content' }] })),
    ).toEqual([
      { type: 'margin', id: 't2', title: 'Edit', status: 'completed' },
      { type: 'ruled', path: 'a.js', oldText: '', newText: 'x' },
    ]);
  });

  it('lights the candle only from a real usage report', () => {
    expect(toSpellEvents(update({ sessionUpdate: 'usage_update', used: 5, size: 10 }))).toEqual([{ type: 'candle', used: 5, size: 10 }]);
    expect(toSpellEvents(update({ sessionUpdate: 'usage_update', used: '5' }))).toEqual([]);
  });

  it('reads the turn end as a seal', () => {
    expect(toSpellEvents({ jsonrpc: '2.0', id: 1, result: { stopReason: 'end_turn' } })).toEqual([{ type: 'sealed', stopReason: 'end_turn' }]);
    expect(toSpellEvents({ stopReason: 'cancelled' })).toEqual([{ type: 'sealed', stopReason: 'cancelled' }]);
  });

  it('ignores thoughts, plans and garbage', () => {
    expect(toSpellEvents(update({ sessionUpdate: 'agent_thought_chunk', content: { type: 'text', text: 'hm' } }))).toEqual([]);
    expect(toSpellEvents(update({ sessionUpdate: 'plan', entries: [] }))).toEqual([]);
    for (const junk of [null, {}, 'str', 3, []]) expect(toSpellEvents(junk)).toEqual([]);
  });
});

describe('runKiro', () => {
  it('runs a turn in the body and streams it in order, the seal as its result', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'r7-kiro-'));
    const argvFile = join(dir, 'argv.json');
    const events: SpellEvent[] = [];
    const r = await runKiro({ cli: FAKE_KIRO, cwd: dir, text: '-fix "it"', resume: false, env: env({ FAKE_KIRO_ARGV: argvFile }), onEvent: (e) => events.push(e) });
    expect(r).toEqual({ ok: true, stopReason: 'end_turn' });
    expect(events.map((e) => e.type)).toEqual(['quill', 'quill', 'margin', 'margin', 'margin', 'ruled', 'candle']);
    const argv = JSON.parse(await readFile(argvFile, 'utf8')) as string[];
    expect(argv.slice(-2)).toEqual(['--', '-fix "it"']);
  });

  it('reports a failed turn by its last words', async () => {
    const r = await runKiro({ cli: FAKE_KIRO, cwd: tmpdir(), text: 'x', resume: false, env: env({ FAKE_KIRO_MODE: 'fail' }), onEvent: () => {} });
    expect(r).toEqual({ ok: false, error: 'error: not logged in' });
  });

  it('says so when kiro-cli is not installed', async () => {
    const r = await runKiro({ cli: '/nonexistent/kiro-cli', cwd: tmpdir(), text: 'x', resume: false, env: env(), onEvent: () => {} });
    expect(r).toEqual({ ok: false, error: 'kiro-cli is not installed (or not on PATH)' });
  });

  it('breaks off a turn that hangs', async () => {
    const ac = new AbortController();
    const t0 = Date.now();
    const r = await runKiro({ cli: FAKE_KIRO, cwd: tmpdir(), text: 'x', resume: false, env: env({ FAKE_KIRO_MODE: 'hang' }), signal: ac.signal, onEvent: () => ac.abort() });
    expect(r).toEqual({ ok: false, error: 'stopped' });
    expect(Date.now() - t0).toBeLessThan(3000);
  });

  it('gives up on a turn past its timeout', async () => {
    const r = await runKiro({ cli: FAKE_KIRO, cwd: tmpdir(), text: 'x', resume: false, env: env({ FAKE_KIRO_MODE: 'hang' }), timeoutMs: 300, onEvent: () => {} });
    expect(r.ok).toBe(false);
  });
});

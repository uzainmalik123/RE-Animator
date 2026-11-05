#!/usr/bin/env node
// A stand-in for `kiro-cli chat --output-format stream-json` (R7 tests, KI-R21): it never calls Kiro,
// so no Kiro tokens are spent. It writes ACP JSON Lines shaped like the real stream as we understand
// it. FAKE_KIRO_MODE: heal (default) | fail | hang | silent (exits 0 with no seal). FAKE_KIRO_ARGV: a file to record argv in. Like
// Kiro, it edits the body it runs in: a heal appends a line to ./server.js if there is one.
import { appendFileSync, existsSync, writeFileSync } from 'node:fs';

const mode = process.env.FAKE_KIRO_MODE ?? 'heal';
if (process.env.FAKE_KIRO_ARGV) writeFileSync(process.env.FAKE_KIRO_ARGV, JSON.stringify(process.argv.slice(2)));

const say = (v) => process.stdout.write(JSON.stringify(v) + '\n');
const update = (u) => say({ jsonrpc: '2.0', method: 'session/update', params: { sessionId: 'sess_fake', update: u } });

if (mode === 'silent') process.exit(0);
if (mode === 'fail') {
  process.stderr.write('error: not logged in\n');
  process.exit(1);
}

update({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'I will look at ' } });
if (mode === 'hang') {
  setInterval(() => {}, 1000);
} else {
  update({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'the guestbook.' } });
  update({ sessionUpdate: 'tool_call', toolCallId: 't1', title: 'Reading server.js', kind: 'read', status: 'pending' });
  update({ sessionUpdate: 'tool_call_update', toolCallId: 't1', status: 'completed' });
  if (existsSync('server.js')) appendFileSync('server.js', '// healed\n');
  update({
    sessionUpdate: 'tool_call_update',
    toolCallId: 't2',
    title: 'Editing server.js',
    kind: 'edit',
    status: 'completed',
    content: [{ type: 'diff', path: 'server.js', oldText: 'a\nb', newText: 'a\nB' }],
  });
  update({ sessionUpdate: 'usage_update', used: 1200, size: 200000 });
  say({ jsonrpc: '2.0', id: 1, result: { stopReason: 'end_turn' } });
}

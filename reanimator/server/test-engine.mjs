// A stand-in for the Poltergeist CLI in tests (never shipped): it writes a run's events.ndjson in two
// chunks (the second finishing a line the first started) and a one-wound report, then exits.
// STUB_CODE=2 fails like a missing key; STUB_HANG=1 never finishes.
import { mkdirSync, appendFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const specDir = argv[argv.indexOf('--spec') + 1];
writeFileSync(join(process.cwd(), 'argv.json'), JSON.stringify(argv));
const code = Number(process.env.STUB_CODE ?? '1');
if (process.env.STUB_CRASH === '1') {
  console.error("Error: Cannot find package 'tsx'");
  process.exit(1);
}
if (code === 2) {
  console.error('error: The LLM client could not be set up: no key');
  process.exit(2);
}
const runDir = join(process.cwd(), '.poltergeist', 'runs', 'stub-1');
mkdirSync(runDir, { recursive: true });
const events = join(runDir, 'events.ndjson');
const started = JSON.stringify({ t: 1, type: 'run.started', runId: 'stub-1', runDir, specDir, target: 'x', criteria: ['1.2'], personas: ['wraith'], reps: 3 });
const plan = JSON.stringify({ t: 2, type: 'plan.compiled', criterion: '1.2', persona: 'wraith', status: 'compiled', cached: false });
appendFileSync(events, `${started}\n${plan.slice(0, 20)}`);
await new Promise((r) => setTimeout(r, 300));
const spawned = { t: 3, type: 'ghost.spawned', ghostId: 'g1', criterion: '1.2', persona: 'wraith', rep: 1, actor: 'a' };
const step = { t: 4, type: 'ghost.step', ghostId: 'g1', index: 0, step: 'click', outcome: 'ok', x: 3, y: 4 };
appendFileSync(events, `${plan.slice(20)}\n${JSON.stringify({ t: 3, type: 'ghost.step', ghost: 'g' })}\n${JSON.stringify(spawned)}\n${JSON.stringify(step)}\n`);
const marks = [0, 1, 2].map((seq, i) => JSON.stringify({ ghostId: 'g1', seq, t: [1000, 1500, 2100][i] }));
appendFileSync(join(runDir, 'frames.ndjson'), `${marks.join('\n')}\n`);
if (process.env.STUB_HANG === '1') setInterval(() => {}, 1000);
else {
  const pair = { persona: 'wraith', verdict: 'haunted', reason: 'two entries', notes: [], reps: 3, repsRun: 3, threshold: 2, expected: [], failing: [], failedReps: [1, 2, 3], outcomes: {}, artifacts: [] };
  const report = { version: 1, runId: 'stub-1', counts: { haunted: 1, flaky: 0, inconclusive: 0, clean: 0, notApplicable: 0, notRun: 0 }, criteria: [{ id: '1.2', text: 'record only one entry', pairs: [pair] }] };
  writeFileSync(join(specDir, 'haunting-report.json'), JSON.stringify(report));
  process.exit(code);
}

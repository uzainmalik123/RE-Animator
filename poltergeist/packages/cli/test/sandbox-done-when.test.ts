import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { foldLive, summon, type LiveMessage } from '@poltergeist/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { makeClaimsProject, type ClaimsProject } from '../../core/test/summon/project-fixture.js';
import { startSandbox, type Sandbox } from '../src/sandbox/index.js';

// PRD F21 Done-when, fixture-first (D-49): the sandbox survives ten back-to-back runs from the plan cache alone.
// The public container on the real Candy Swap is KI-70.

let project: ClaimsProject;
let sandbox: Sandbox;
beforeAll(async () => {
  project = await makeClaimsProject();
  // The operator warms the cache with one ordinary summon; the sandbox never calls an LLM.
  await summon({ specDir: project.specDir, configPath: project.configPath, cwd: project.root, env: project.env, llm: project.llm().client, only: ['3.2'], personas: ['doppelganger'], reps: 1, runOptions: { frameFps: 0 } });
  sandbox = await startSandbox({
    specDir: project.specDir, configPath: project.configPath, cwd: project.root, env: project.env, reps: 1,
    keep: 3, perClientHour: 0, trustProxy: false, runTimeoutMs: 120_000, port: 0,
    summonOverrides: { runOptions: { frameFps: 0 } },
  });
}, 120_000);
afterAll(async () => {
  await sandbox?.close();
  await project?.close();
});

const post = () => fetch(`${sandbox.url}/runs`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ only: ['3.2'], personas: ['doppelganger'] }) });

/** Folds the live feed until `run.finished`. */
function watch(live: string): Promise<LiveMessage[]> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${sandbox.url.replace('http', 'ws')}${live}`);
    const got: LiveMessage[] = [];
    ws.on('message', (d) => {
      const m = JSON.parse(String(d)) as LiveMessage;
      got.push(m);
      if (m.type === 'run.finished') {
        ws.close();
        resolve(got);
      }
    });
    ws.on('error', reject);
  });
}

async function settled(runId: string) {
  for (;;) {
    const s = (await (await fetch(`${sandbox.url}/runs/${runId}`)).json()) as { status: string; haunted?: string[]; cacheMisses?: number };
    if (s.status !== 'running') return s;
    await new Promise((r) => setTimeout(r, 50));
  }
}

describe('F21 Done-when (fixture)', () => {
  it('survives ten back-to-back runs from cached plans only', async () => {
    for (let i = 0; i < 10; i++) {
      const res = await post();
      expect(res.status, `run ${i + 1}`).toBe(202);
      const { runId, live } = (await res.json()) as { runId: string; live: string };
      if (i === 0) expect((await post()).status).toBe(409);
      const feed = await watch(live);
      const s = await settled(runId);
      expect(s, `run ${i + 1}`).toMatchObject({ status: 'finished', haunted: ['3.2'], cacheMisses: 0 });
      expect(foldLive(feed).lines.find((l) => l.id === '3.2')?.status).toBe('haunted');
    }
    const kept = ((await (await fetch(`${sandbox.url}/runs`)).json()) as { runs: { runId: string }[] }).runs.map((r) => r.runId);
    expect(kept).toHaveLength(3);
    // The three kept runs plus the operator's warm-up run, which the sandbox didn't start and never deletes.
    const onDisk = await readdir(join(project.root, '.poltergeist', 'runs'));
    expect(onDisk).toHaveLength(4);
    for (const id of kept) expect(onDisk).toContain(id);
  }, 300_000);
});

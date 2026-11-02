import { existsSync } from 'node:fs';
import { mkdtemp, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { foldLive, reduceLive, initialLiveState, type LiveMessage, type RecordingManifest, type SummonEvent } from '@poltergeist/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { makeClaimsProject, type ClaimsProject } from '../../core/test/summon/project-fixture.js';
import { main, type MainDeps } from '../src/main.js';

// PRD F15 Done-when, fixture-first (D-43): a real haunting, exported and replayed with no app, LLM or browser.
// The public URL replaying the hero Candy Swap run is Reanimator R11's (KI-55).

let project: ClaimsProject;
beforeAll(async () => {
  project = await makeClaimsProject();
});
afterAll(async () => project?.close());

function capture(onStdout?: (s: string) => void) {
  const out = { stdout: '', stderr: '' };
  const deps: MainDeps = {
    stdout: { write: (s) => { out.stdout += s; onStdout?.(s); }, isTTY: false },
    stderr: { write: (s) => void (out.stderr += s) },
    env: { ...project.env, NO_COLOR: '1' },
    summonOverrides: { llm: project.llm().client, runOptions: { frameFps: 4 } },
  };
  return { out, deps };
}

describe('F15 Done-when (fixture)', () => {
  it('summons, exports a labelled bundle under 50 MB, and replays it to the same board with 3.2 haunted and its evidence frame', async () => {
    const summoned = capture();
    expect(await main(['summon', '--spec', project.specDir, '--config', project.configPath, '--personas', 'wraith,doppelganger'], summoned.deps)).toBe(1);
    const runs = join(dirname(project.configPath), '.poltergeist', 'runs');
    const [runId] = await readdir(runs);
    const runDir = join(runs, runId!);

    // The app is gone from here on: replay must not need it.
    await project.fixture.close();

    const out = join(await mkdtemp(join(tmpdir(), 'f15-')), 'bundle');
    const exported = capture();
    expect(await main(['export', runDir, '--out', out], exported.deps), exported.out.stderr).toBe(0);
    const manifest = JSON.parse(await readFile(join(out, 'recording.json'), 'utf8')) as RecordingManifest;
    expect(manifest).toMatchObject({ recorded: true, runId, haunted: ['3.2'] });
    expect(manifest.frames).toBeGreaterThan(0);
    const bytes = Number(/(\d+\.\d) MB/.exec(exported.out.stdout)?.[1]);
    expect(bytes).toBeLessThan(50);

    const got: LiveMessage[] = [];
    let finished!: () => void;
    const done = new Promise<void>((r) => (finished = r));
    const replayed = capture((s) => {
      const url = /(ws:\/\/127\.0\.0\.1:\d+\/runs\/\S+)/.exec(s)?.[1];
      if (!url) return;
      new WebSocket(url).on('message', (data) => {
        const m = JSON.parse(String(data)) as LiveMessage;
        got.push(m);
        if (m.type === 'run.finished') finished();
      });
    });
    const code = main(['replay', out, '--speed', '16'], { ...replayed.deps, seancePort: 0 });
    await done;
    expect(await code, replayed.out.stderr).toBe(0);
    expect(replayed.out.stdout).toContain('RECORDED');

    expect(got[0]).toMatchObject({ type: 'live.hello', recorded: true, speed: 16, runId });
    const live = got.reduce(reduceLive, initialLiveState());
    const disk = (await readFile(join(runDir, 'events.ndjson'), 'utf8')).trim().split('\n').map((l) => JSON.parse(l) as SummonEvent);
    const expected = foldLive(disk);
    expect(live.recorded).toBe(true);
    expect(live.phase).toBe('finished');
    expect(live.lines.map((l) => [l.id, l.status])).toEqual(expected.lines.map((l) => [l.id, l.status]));
    const haunted = live.lines.find((l) => l.id === '3.2');
    expect(haunted?.status).toBe('haunted');
    expect(haunted?.evidence?.frame).toBeDefined();
    expect(existsSync(join(out, haunted!.evidence!.frame!))).toBe(true);
  }, 120_000);
});

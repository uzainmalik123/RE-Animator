import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadRecording, type SummonEvent } from '@poltergeist/core';
import { describe, expect, it } from 'vitest';
import { A, runEvents, writeRunDir } from '../../core/test/recording/run-dir.js';
import { main } from '../src/main.js';
import { playRecording } from '../src/replay.js';

// PRD F15 (D-43): a recording re-streamed on the live feed, paced by its own clock.

describe('playRecording', () => {
  it('publishes the timeline in order, sleeping the gaps divided by speed, with frames read from disk', async () => {
    const { dir } = await writeRunDir(2);
    const rec = await loadRecording(dir);
    const sleeps: number[] = [];
    const got: SummonEvent[] = [];
    await playRecording(rec, { speed: 4, publish: (e) => got.push(e), sleep: async (ms) => void sleeps.push(ms) });
    expect(got).toHaveLength(rec.timeline.length);
    expect(got.filter((e) => e.type !== 'ghost.frame')).toEqual(runEvents);
    const frame = got.find((e) => e.type === 'ghost.frame' && e.ghostId === A && e.seq === 1);
    expect(frame).toMatchObject({ jpegBase64: Buffer.alloc(1000, 1).toString('base64'), t: 1150 });
    const ats = rec.timeline.map((e) => e.at);
    expect(sleeps).toEqual(ats.slice(1).map((at, i) => (at - ats[i]!) / 4).filter((ms) => ms > 0));
  });

  it('plays an aborted run (no run.finished) to its last event', async () => {
    const { dir } = await writeRunDir(0);
    const rec = await loadRecording(dir);
    const cut = { ...rec, timeline: rec.timeline.filter((e) => !('event' in e) || e.event.type !== 'run.finished') };
    const got: SummonEvent[] = [];
    await playRecording(cut, { speed: 16, publish: (e) => got.push(e), sleep: async () => {} });
    expect(got.at(-1)?.type).toBe('verdict.criterion');
  });

  it('skips a frame whose jpg vanished', async () => {
    const { dir } = await writeRunDir(1);
    const rec = await loadRecording(dir);
    const broken = { ...rec, readFrame: () => Promise.reject(new Error('ENOENT')) };
    const got: SummonEvent[] = [];
    await playRecording(broken, { speed: 1, publish: (e) => got.push(e), sleep: async () => {} });
    expect(got.some((e) => e.type === 'ghost.frame')).toBe(false);
    expect(got).toHaveLength(runEvents.length);
  });

  it('stops when aborted', async () => {
    const { dir } = await writeRunDir(1);
    const rec = await loadRecording(dir);
    const ac = new AbortController();
    const got: SummonEvent[] = [];
    const play = playRecording(rec, { speed: 1, signal: ac.signal, publish: (e) => { got.push(e); ac.abort(); }, sleep: async () => {} });
    await expect(play).rejects.toThrow();
    expect(got).toHaveLength(1);
  });
});

describe('poltergeist replay', () => {
  it('waits for a client and exits 130 when aborted first', async () => {
    const { dir } = await writeRunDir(1);
    const ac = new AbortController();
    let stdout = '';
    const code = main(['replay', dir], {
      stdout: { write: (s) => void (stdout += s) }, stderr: { write: () => {} }, env: { NO_COLOR: '1' }, seancePort: 0, signal: ac.signal,
    });
    await new Promise((r) => setTimeout(r, 100));
    expect(stdout).toMatch(/RECORDED  replay: ws:\/\/127\.0\.0\.1:\d+\/runs\/20261102-120000-abcd \(waiting for a client…\)/);
    ac.abort(new DOMException('aborted', 'AbortError'));
    expect(await code).toBe(130);
  });

  it('exits 2 on a folder that is not a recording', async () => {
    let stderr = '';
    const code = await main(['replay', await mkdtemp(join(tmpdir(), 'nothing-'))], { stdout: { write: () => {} }, stderr: { write: (s) => void (stderr += s) }, env: { NO_COLOR: '1' }, seancePort: 0 });
    expect(code).toBe(2);
    expect(stderr).toMatch(/error: no events\.ndjson/);
  });
});

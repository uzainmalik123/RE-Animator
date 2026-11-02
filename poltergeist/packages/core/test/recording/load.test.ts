import { appendFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadRecording, RecordingError } from '../../src/recording/index.js';
import { A, runEvents, writeRunDir } from './run-dir.js';

// PRD F15 (D-43): a run folder or an exported bundle, read back for replay.

describe('loadRecording', () => {
  it('reads events and the frame index of a run folder', async () => {
    const { dir, marks } = await writeRunDir(3);
    const rec = await loadRecording(dir);
    expect(rec.runId).toBe('20261102-120000-abcd');
    expect(rec.events).toEqual(runEvents);
    expect(rec.frames).toEqual(marks);
    expect(rec.estimatedFrames).toBe(false);
    expect(rec.timeline.length).toBe(runEvents.length + marks.length);
    expect(await rec.readFrame({ ghostId: A, seq: 2 })).toEqual(Buffer.alloc(1000, 2));
  });

  it('estimates frame times for a run folder from before frames.ndjson', async () => {
    const { dir } = await writeRunDir(3);
    await rm(join(dir, 'frames.ndjson'));
    const rec = await loadRecording(dir);
    expect(rec.estimatedFrames).toBe(true);
    expect(rec.frames).toHaveLength(6);
    expect(rec.frames.every((f) => f.t > 1020 && f.t < 1600)).toBe(true);
  });

  it('drops frame marks whose jpg is missing', async () => {
    const { dir } = await writeRunDir(2);
    await rm(join(dir, 'frames', A, '00001.jpg'));
    expect((await loadRecording(dir)).frames.filter((f) => f.ghostId === A).map((f) => f.seq)).toEqual([0]);
  });

  it('skips a torn last line with one warning', async () => {
    const { dir } = await writeRunDir(1);
    await appendFile(join(dir, 'events.ndjson'), '{"type":"ghost.st');
    const warnings: string[] = [];
    const rec = await loadRecording(dir, { onWarning: (m) => warnings.push(m) });
    expect(rec.events).toEqual(runEvents);
    expect(warnings).toHaveLength(1);
  });

  it('refuses a folder with no events.ndjson or no run.started', async () => {
    const { dir } = await writeRunDir(0);
    await expect(loadRecording(join(dir, 'frames'))).rejects.toThrow(RecordingError);
    const { writeFile } = await import('node:fs/promises');
    await writeFile(join(dir, 'events.ndjson'), `${JSON.stringify(runEvents[1])}\n`);
    await expect(loadRecording(dir)).rejects.toThrow(/run\.started/);
  });
});

import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { exportRecording, loadRecording, RecordingError, type RecordingManifest } from '../../src/recording/index.js';
import { A, B, FRAME_BYTES, runEvents, writeRunDir } from './run-dir.js';

// PRD F15 (D-43): a run folder → a small static bundle Reanimator can host.

const freshOut = async () => join(await mkdtemp(join(tmpdir(), 'rec-out-')), 'bundle');
const now = () => new Date('2026-11-02T12:00:00Z');
const seqs = async (dir: string, ghostId: string) => (await readdir(join(dir, 'frames', ghostId))).sort();

describe('exportRecording', () => {
  it('copies events, frames, the frame index and verdicts with a manifest', async () => {
    const { dir } = await writeRunDir(6);
    const outDir = await freshOut();
    const { manifest, bytes } = await exportRecording({ runDir: dir, outDir, now });
    expect(manifest).toEqual<RecordingManifest>({
      format: 'poltergeist-recording', version: 1, recorded: true, runId: '20261102-120000-abcd', target: 'http://127.0.0.1:4000',
      criteria: ['3.1', '3.2'], personas: ['wraith', 'doppelganger'], reps: 1,
      counts: { clean: 1, haunted: 1, flaky: 0, inconclusive: 0, notApplicable: 2, uncompilable: 0 }, haunted: ['3.2'],
      durationMs: 620, frames: 12, droppedFrames: 0, exportedAt: '2026-11-02T12:00:00.000Z',
    });
    expect(JSON.parse(await readFile(join(outDir, 'recording.json'), 'utf8'))).toEqual(manifest);
    expect(bytes).toBeGreaterThanOrEqual(12 * FRAME_BYTES);
    expect((await readdir(outDir)).sort()).toEqual(['events.ndjson', 'frames', 'frames.ndjson', 'recording.json', 'verdicts.json']);
    const back = await loadRecording(outDir);
    expect(back.events).toEqual(runEvents);
    expect(back.frames).toHaveLength(12);
    expect(back.estimatedFrames).toBe(false);
  });

  it('thins frames under the cap, keeping the failed ghost\'s frames and every ghost\'s last one', async () => {
    const { dir } = await writeRunDir(6);
    const outDir = await freshOut();
    const maxBytes = 9 * FRAME_BYTES + 2000;
    const { manifest, bytes } = await exportRecording({ runDir: dir, outDir, maxBytes, now });
    expect(bytes).toBeLessThanOrEqual(maxBytes);
    expect(await seqs(outDir, A)).toHaveLength(6);
    expect(await seqs(outDir, B)).toContain('00005.jpg');
    expect(manifest.frames + manifest.droppedFrames).toBe(12);
    expect(manifest.droppedFrames).toBeGreaterThan(0);
    expect((await loadRecording(outDir)).frames).toHaveLength(manifest.frames);
  });

  it('refuses before writing when even the protected frames are over the cap', async () => {
    const { dir } = await writeRunDir(6);
    const outDir = await freshOut();
    await expect(exportRecording({ runDir: dir, outDir, maxBytes: 3 * FRAME_BYTES })).rejects.toThrow(/over the 0\.0 MB cap/);
    expect(existsSync(outDir)).toBe(false);
  });

  it('refuses a non-empty out dir, or one inside the run folder', async () => {
    const { dir } = await writeRunDir(1);
    const outDir = await freshOut();
    await mkdir(outDir);
    await writeFile(join(outDir, 'keep.txt'), 'mine');
    await expect(exportRecording({ runDir: dir, outDir })).rejects.toThrow(RecordingError);
    expect(await readdir(outDir)).toEqual(['keep.txt']);
    await expect(exportRecording({ runDir: dir, outDir: join(dir, 'x') })).rejects.toThrow(/inside the run folder/);
    await expect(exportRecording({ runDir: dir, outDir: dir })).rejects.toThrow(RecordingError);
  });

  it('accepts an existing empty out dir', async () => {
    const { dir } = await writeRunDir(1);
    const outDir = await freshOut();
    await mkdir(outDir);
    await exportRecording({ runDir: dir, outDir });
    expect(existsSync(join(outDir, 'recording.json'))).toBe(true);
  });
});

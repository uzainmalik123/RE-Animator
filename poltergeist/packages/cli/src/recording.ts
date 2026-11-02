import { resolve } from 'node:path';
import { exportRecording } from '@poltergeist/core';
import { termSafe } from './term/color.js';

type Io = { stdout: { write(s: string): void }; warn(s: string): void; cwd: string };

/** `poltergeist export <runDir> --out <dir>` (PRD F15, D-43). Throws on refusal; `main` maps that to exit 2. */
export async function runExport(args: { runDir: string; out: string; maxMb?: number }, io: Io): Promise<number> {
  const { outDir, bytes, manifest } = await exportRecording({
    runDir: resolve(io.cwd, args.runDir),
    outDir: resolve(io.cwd, args.out),
    ...(args.maxMb !== undefined ? { maxBytes: args.maxMb * 1024 * 1024 } : {}),
    onWarning: io.warn,
  });
  io.stdout.write(`recording: ${termSafe(outDir, 300)} (${manifest.frames} frames, ${manifest.droppedFrames} dropped, ${(bytes / 1024 / 1024).toFixed(1)} MB)\n`);
  io.stdout.write(`RECORDED run ${termSafe(manifest.runId, 60)}\n`);
  return 0;
}

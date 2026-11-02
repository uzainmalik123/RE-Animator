import { resolve } from 'node:path';
import { exportRecording, loadRecording } from '@poltergeist/core';
import { playRecording } from './replay.js';
import { startEventServer } from './seance-server.js';
import { paint, termSafe } from './term/color.js';

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

/** After `run.finished` the socket stays up this long, so clients drain before the close. */
const LINGER_MS = 500;

/**
 * `poltergeist replay <dir> [--speed n]` (PRD F15, D-43): serves a run folder or bundle on the live-feed WebSocket,
 * labelled `recorded`, from the first client on. Rejects on abort; `main` maps that to exit 130.
 */
export async function runReplay(
  args: { dir: string; speed: number },
  io: Io & { color: boolean; port: number; signal: AbortSignal },
): Promise<number> {
  const rec = await loadRecording(resolve(io.cwd, args.dir), { onWarning: io.warn });
  if (rec.estimatedFrames && rec.frames.length) io.warn('no frames.ndjson (a run from before F15): frame times are estimated');
  const server = await startEventServer(rec.runId, { port: io.port, hello: { recorded: true, speed: args.speed } });
  const aborted = new Promise<never>((_, reject) => {
    const stop = () => reject(io.signal.reason as Error);
    if (io.signal.aborted) stop();
    else io.signal.addEventListener('abort', stop, { once: true });
  });
  aborted.catch(() => {}); // only awaited inside the race below
  try {
    io.stdout.write(`${paint('RECORDED', 'flaky', io.color)}  replay: ${server.url} (waiting for a client…)\n`);
    await Promise.race([server.firstClient(), aborted]);
    io.stdout.write(`replaying run ${termSafe(rec.runId, 60)} at ${args.speed}×\n`);
    await playRecording(rec, { speed: args.speed, publish: (e) => server.publish(e), signal: io.signal });
    await Promise.race([new Promise((r) => setTimeout(r, LINGER_MS)), aborted]);
    io.stdout.write('replay finished\n');
    return 0;
  } finally {
    await server.close();
  }
}

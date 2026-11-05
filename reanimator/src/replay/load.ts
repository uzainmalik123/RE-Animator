import { isManifest, parseLines, type Manifest, type RecordedLine } from '../../shared/recording';

// R11 (D-R22): the recording is static files beside the page (public/recording/ in the repo).

export type Loaded = { manifest: Manifest; lines: RecordedLine[] } | { missing: true } | { error: string };

export const recordingBase = (): string => `${import.meta.env.BASE_URL}recording/`;

// A frame of the app under attack, as the recorder kept it.
export const replayFrameUrl =
  (base: string) =>
  (attackId: string, ghostId: string, seq: number): string =>
    `${base}frames/${encodeURIComponent(attackId)}/${encodeURIComponent(ghostId)}/${seq}.jpg`;

// No recording published (a 404, or a server's fallback page instead of JSON) is `missing`, not an
// error: the page then says so plainly instead of playing anything.
export async function loadRecording(fetchFn: (url: string) => Promise<Response>, base = recordingBase()): Promise<Loaded> {
  try {
    const res = await fetchFn(`${base}recording.json`);
    if (res.status === 404) return { missing: true };
    if (!res.ok) return { error: `could not fetch the recording (HTTP ${res.status})` };
    let manifest: unknown;
    try {
      manifest = JSON.parse(await res.text());
    } catch {
      return { missing: true };
    }
    if (!isManifest(manifest)) return { error: 'this is not a Reanimator recording' };
    const events = await fetchFn(`${base}events.ndjson`);
    if (!events.ok) return { error: `could not fetch the recording's events (HTTP ${events.status})` };
    let lines;
    try {
      lines = parseLines(await events.text());
    } catch (e) {
      return { error: `the recording is damaged: ${e instanceof Error ? e.message : String(e)}` };
    }
    // A server started with recording on but nothing run: there is no run to call a replay (D-R11).
    return lines.length === 0 ? { missing: true } : { manifest, lines };
  } catch {
    return { error: 'could not fetch the recording' };
  }
}

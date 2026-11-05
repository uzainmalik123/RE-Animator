import { describe, expect, it } from 'vitest';
import { loadRecording, recordingBase, replayFrameUrl } from './load';

const manifest = { format: 'reanimator-recording', version: 1, recordedAt: '2026-11-20T10:00:00Z' };
const line = { t: 0, stream: 'ritual', id: 'r1', event: { type: 'started', repo: 'x', diedIn: 2016 } };
const files = (map: Record<string, { status: number; body: string }>) => async (url: string) => {
  const f = map[url] ?? { status: 404, body: '' };
  return new Response(f.body, { status: f.status });
};

describe('loadRecording (R11)', () => {
  it('says there is no recording yet when none was published', async () => {
    expect(await loadRecording(files({}), './recording/')).toEqual({ missing: true });
  });

  it('takes a page served in place of the manifest (a dev server fallback) as no recording', async () => {
    expect(await loadRecording(files({ './recording/recording.json': { status: 200, body: '<!doctype html>' } }), './recording/')).toEqual({ missing: true });
  });

  it('loads the manifest and the lines', async () => {
    const r = await loadRecording(
      files({ './recording/recording.json': { status: 200, body: JSON.stringify(manifest) }, './recording/events.ndjson': { status: 200, body: `${JSON.stringify(line)}\n` } }),
      './recording/',
    );
    expect(r).toEqual({ manifest, lines: [line] });
  });

  it('refuses a manifest of another format', async () => {
    const r = await loadRecording(files({ './recording/recording.json': { status: 200, body: '{"format":"x"}' } }), './recording/');
    expect(r).toEqual({ error: 'this is not a Reanimator recording' });
  });

  it('reports a bad line', async () => {
    const r = await loadRecording(
      files({ './recording/recording.json': { status: 200, body: JSON.stringify(manifest) }, './recording/events.ndjson': { status: 200, body: 'nope\n' } }),
      './recording/',
    );
    expect(r).toEqual({ error: 'the recording is damaged: bad recording line 1' });
  });

  it('reports a network failure', async () => {
    const r = await loadRecording(async () => Promise.reject(new Error('offline')), './recording/');
    expect(r).toEqual({ error: 'could not fetch the recording' });
  });
});

describe('recording paths (R11)', () => {
  it('lives under the base path', () => {
    expect(recordingBase()).toBe(`${import.meta.env.BASE_URL}recording/`);
  });

  it('finds a frame as a file beside the recording', () => {
    expect(replayFrameUrl('./recording/')('a 1', 'g', 3)).toBe('./recording/frames/a%201/g/3.jpg');
  });
});

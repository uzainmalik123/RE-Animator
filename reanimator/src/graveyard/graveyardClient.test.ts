import { describe, expect, it, vi } from 'vitest';
import { fetchGraveyard } from './graveyardClient';

const json = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status });
const stone = { id: 'tally-2014', name: 'tally-2014', diedIn: 2014, licence: 'MIT', chart: true };

describe('fetchGraveyard', () => {
  it('returns the graves', async () => {
    const fetchFn = vi.fn(json(200, { graves: [stone] }));
    expect(await fetchGraveyard(fetchFn)).toEqual({ graves: [stone] });
    expect(fetchFn).toHaveBeenCalledWith('/api/graveyard', { method: 'GET' });
  });

  it('returns an empty graveyard as empty, not an error', async () => {
    expect(await fetchGraveyard(json(200, { graves: [] }))).toEqual({ graves: [] });
  });

  it('explains a backend that is down', async () => {
    const r = await fetchGraveyard(async () => {
      throw new TypeError('fetch failed');
    });
    expect(r).toEqual({ error: 'the backend is not answering (npm run server)' });
  });

  it('explains a refusal', async () => {
    expect(await fetchGraveyard(json(404, {}))).toEqual({ error: 'the backend would not open the graveyard (HTTP 404)' });
  });

  it.each([[{}], [{ graves: 'x' }], [{ graves: [{ id: '../x' }] }], [null]])('refuses an unreadable body %o', async (body) => {
    expect(await fetchGraveyard(json(200, body))).toEqual({ error: 'the graveyard answered with something unreadable' });
  });

  it('refuses a body that is not JSON', async () => {
    expect(await fetchGraveyard(async () => new Response('<html>', { status: 200 }))).toEqual({ error: 'the graveyard answered with something unreadable' });
  });
});

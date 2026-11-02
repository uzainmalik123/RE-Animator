import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';

describe('createApp', () => {
  it('reports health', async () => {
    const res = await createApp().request('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, name: 'reanimator' });
  });

  it('404s unknown api paths', async () => {
    const res = await createApp().request('/api/nope');
    expect(res.status).toBe(404);
  });
});

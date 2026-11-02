import { Hono } from 'hono';

// The backend's routes. R2/R3 add revive and attack here; R0 only proves it's alive.
export function createApp(): Hono {
  const app = new Hono();
  app.get('/api/health', (c) => c.json({ ok: true, name: 'reanimator' }));
  return app;
}

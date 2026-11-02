import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { resolvePort } from './port.js';

// Loopback only: this backend will run install/build/attack commands, so it must never face the LAN.
const hostname = '127.0.0.1';
const port = resolvePort(process.env.REANIMATOR_PORT);

serve({ fetch: createApp().fetch, hostname, port }, (info) => {
  console.log(`Reanimator backend listening on http://${hostname}:${info.port}`);
});

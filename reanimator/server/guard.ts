// KI-R12: the backend runs install/build/serve commands, so only loopback callers may reach it.
// Host must be a loopback name (stops DNS rebinding); Origin, when a browser sends one, must be a
// loopback http(s) origin (stops other sites' pages from driving it).
import type { MiddlewareHandler } from 'hono';

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);

function loopbackHost(host: string | undefined): boolean {
  if (!host) return false;
  try {
    return LOOPBACK.has(new URL(`http://${host}`).hostname);
  } catch {
    return false;
  }
}

function loopbackOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    return (u.protocol === 'http:' || u.protocol === 'https:') && LOOPBACK.has(u.hostname);
  } catch {
    return false;
  }
}

export function loopbackGuard(): MiddlewareHandler {
  return async (c, next) => {
    const origin = c.req.header('origin');
    if (!loopbackHost(c.req.header('host') ?? new URL(c.req.url).host) || (origin !== undefined && !loopbackOrigin(origin))) {
      return c.json({ error: 'forbidden: loopback callers only' }, 403);
    }
    await next();
  };
}

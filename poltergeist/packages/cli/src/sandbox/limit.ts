import type { IncomingHttpHeaders } from 'node:http';

const WINDOW_MS = 3_600_000;

export type RateLimiter = {
  /** Records nothing: a request that is refused for another reason must not cost a run. */
  check(key: string): { ok: true } | { ok: false; retryAfterSec: number };
  record(key: string): void;
};

/** At most `perHour` runs per client in any sliding hour; 0 means unlimited (F21, D-49). */
export function createRateLimiter(opts: { perHour: number; now?: () => number }): RateLimiter {
  const now = opts.now ?? Date.now;
  const hits = new Map<string, number[]>();
  const recent = (key: string, t: number) => (hits.get(key) ?? []).filter((at) => at > t - WINDOW_MS);
  return {
    check(key) {
      if (opts.perHour === 0) return { ok: true };
      const t = now();
      const times = recent(key, t);
      if (times.length < opts.perHour) return { ok: true };
      return { ok: false, retryAfterSec: Math.max(1, Math.ceil((times[0]! + WINDOW_MS - t) / 1000)) };
    },
    record(key) {
      const t = now();
      for (const [k, times] of hits) if (times.every((at) => at <= t - WINDOW_MS)) hits.delete(k);
      hits.set(key, [...recent(key, t), t]);
    },
  };
}

/** The socket address, or the first `X-Forwarded-For` hop when the server sits behind a trusted proxy. */
export function clientKey(req: { socket: { remoteAddress?: string }; headers: IncomingHttpHeaders }, trustProxy: boolean): string {
  const header = req.headers['x-forwarded-for'];
  const forwarded = (Array.isArray(header) ? header[0] : header)?.split(',')[0]?.trim();
  if (trustProxy && forwarded) return forwarded;
  return req.socket.remoteAddress ?? 'unknown';
}

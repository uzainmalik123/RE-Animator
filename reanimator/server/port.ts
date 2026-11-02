export const DEFAULT_PORT = 7070;

// Port from REANIMATOR_PORT. A bad value is an error, not port 0: the Vite proxy targets a fixed port,
// so silently binding a random one would break /api with no clue why.
export function resolvePort(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_PORT;
  const port = /^\d+$/.test(raw.trim()) ? Number(raw.trim()) : NaN;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`REANIMATOR_PORT must be an integer from 1 to 65535, got "${raw}"`);
  }
  return port;
}

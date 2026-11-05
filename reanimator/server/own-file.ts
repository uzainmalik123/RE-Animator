// Reading a file from a grave on the host (R9, D-R23). A cloned repo can hold symlinks pointing
// anywhere on the host, so host-side code never follows one: a symlink reads as no file at all.
import { lstat, readFile } from 'node:fs/promises';

export async function readOwn(path: string): Promise<string | null> {
  const s = await lstat(path).catch(() => null);
  return s?.isFile() ? readFile(path, 'utf8') : null;
}

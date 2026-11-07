// The graveyard on the backend (R6): the prepared fixtures on disk, one headstone each. The list is
// the disk itself, so it can never drift from what can really be raised (D-R11).
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { byDeath, isGraveId, type Headstone } from '../shared/graveyard.js';
import { loadFixture } from './fixtures.js';

export const FIXTURES_DIR = fileURLToPath(new URL('../fixtures', import.meta.url));

// Every fixture directory whose manifest loads, oldest death first. A directory that doesn't load
// (or isn't a plain name, or is a stray file) is skipped: one bad fixture must not hide the rest.
export async function listGraves(root: string = FIXTURES_DIR): Promise<Headstone[]> {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const stones = await Promise.all(
    entries
      .filter((e) => e.isDirectory() && isGraveId(e.name))
      .map(async (e): Promise<Headstone | null> => {
        try {
          const f = await loadFixture(join(root, e.name));
          return { id: e.name, name: f.name, diedIn: f.diedIn, licence: f.licence, chart: f.chartDir !== null };
        } catch {
          return null;
        }
      }),
  );
  return stones.filter((s): s is Headstone => s !== null).sort(byDeath);
}

// The directory of a listed grave. The id is checked against the plain-name rule and the listing
// before it is joined onto a path, so nothing from the wire can point outside the fixtures.
export async function graveDir(id: string, root: string = FIXTURES_DIR): Promise<string | null> {
  if (!isGraveId(id)) return null;
  const dir = join(root, id);
  const listed = (await listGraves(root)).some((s) => s.id === id);
  return listed && (await stat(dir).then((s) => s.isDirectory(), () => false)) ? dir : null;
}

// How to serve a body nobody prepared (R9, D-R23): its start script if it has one, else the first
// built folder holding an index.html, served by our own static-serve.mjs; else there is no way.
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readOwn } from './own-file.js';

export const STATIC_SERVE = fileURLToPath(new URL('./static-serve.mjs', import.meta.url));

const FOLDERS = ['dist', 'build', 'public', '.'];

export async function inferServe(dir: string): Promise<string[] | null> {
  try {
    const pkg = JSON.parse((await readOwn(join(dir, 'package.json'))) ?? '{}') as { scripts?: Record<string, unknown> };
    if (typeof pkg.scripts?.start === 'string') return ['npm', 'start'];
  } catch {
    /* no package.json, or a broken one: look for a page instead */
  }
  for (const f of FOLDERS) {
    const site = f === '.' ? dir : join(dir, f);
    if (await stat(join(site, 'index.html')).then((s) => s.isFile(), () => false)) return ['node', STATIC_SERVE, site];
  }
  return null;
}

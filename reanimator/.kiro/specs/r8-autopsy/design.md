# Design: R8, the autopsy

## Overview

```
performRitual
  corpse vitals ─► first failure (vital + detail) ─┐
  copy corpse → revived, apply remedy ─► 'remedy'  │
  buildAutopsy(corpseDir, revivedDir, failure) ◄───┘
        │  (try/catch: a failure here is swallowed)
        ▼
  emit { type:'autopsy', autopsy }  ──► ritual log ──► SSE ──► recorder (R11) ──► replay
        ▼
  reduceRitual → state.autopsy ──► <Autopsy/> in RaiseView (live and replay)
```

## Shared (`shared/autopsy.ts`)

```ts
export type CauseKind = 'engine-pin' | 'node-sass' | 'openssl' | 'lockfile' | 'removed-api' | 'other';
export interface DiffLine { op: '-' | '+' | ' '; text: string }
export interface Cause { kind: CauseKind; title: string; why: string; file: string; lines: DiffLine[]; truncated: boolean; seen: boolean }
export interface Autopsy { diedAt: VitalName | null; symptom: string; causes: Cause[]; skipped: number }
export function isAutopsy(v: unknown): v is Autopsy;       // shape guard, used by the replay loader
export function autopsyMarkdown(repo: string | null, a: Autopsy): string;
export const LIMITS = { fileBytes: 65536, lines: 40, lineChars: 200, causes: 12 };
```

`RitualEvent` gains `{ type: 'autopsy'; autopsy: Autopsy }`; `RitualState` gains `autopsy: Autopsy | null` (IDLE `null`); `'started'` resets it.

## Backend

- `server/diff.ts`: `diffLines(a: string[], b: string[]): DiffLine[]`, an LCS line diff (inputs are capped, so O(n·m) is fine), with 1 line of context, collapsed to hunks.
- `server/autopsy.ts`
  - `REMOVED_APIS: { token: RegExp; name: string }[]`.
  - `buildAutopsy(corpse: string, revived: string, failure: { vital: VitalName; detail: string } | null): Promise<Autopsy>`.
  - Walks both trees (skipping `node_modules`, `.git`; never following symlinks, via `readOwn` from `own-file.ts`), pairs files by relative path, and skips unchanged / binary / oversized ones (counted in `skipped`).
  - `package.json` is compared by parsed top-level field (`engines`, `scripts`, `dependencies`…); `node-sass` leaving a dependency map is its own cause; evidence lines are the compact JSON of the old and new value.
  - `package-lock.json` is never dumped: a deleted lock is one `lockfile` cause with a one-line note.
  - Other text files: `diffLines`; `removed-api` if a removed line matches `REMOVED_APIS`; `.npmrc` lines classify by content (`engine-strict` dropped → `engine-pin`; `openssl-legacy-provider` → `openssl`; `legacy-peer-deps` → `lockfile`); else `other`.
  - `seen` = the failure detail contains the cause's signature (`EBADENGINE`/`engine` for `engine-pin`, the API name for `removed-api`, `node-sass`/`gyp` for `node-sass`, `ERR_OSSL`/`openssl` for `openssl`, `lockfile`/`ERESOLVE` for `lockfile`; `other` is always false).
  - Causes sort by kind order then file; capped at `LIMITS.causes`.
- `server/ritual.ts`: `performRitual` remembers the first failed corpse vital (it already sees every `vital` event), and after `emit(remedy)` runs `buildAutopsy` in a try/catch and emits `autopsy`. It runs before the "no rite fits" check, so a rejected grave still has its reading.

## Frontend

- `src/autopsy/scene.ts` (pure): `slabLuminance(cols, rows, { tMs, causes }): Float32Array`: a body on a slab (bone), a scan line that sweeps top to bottom (magic), and one lit mark per cause, up to 12.
- `src/autopsy/Autopsy.tsx`: the section. Props `{ repo, autopsy }`. Headline, per-cause `<article>` with a `<pre>` ruled box (lines prefixed `−`/`+`/space), a `seen` note, the "Copy autopsy" button (`navigator.clipboard`, "Copied" state, a fallback message when unavailable), and the slab canvas via `useDotCanvas`.
- `src/raise/RaiseView.tsx`: renders `<Autopsy>` when `state.autopsy` exists, inside `Locked`, so in a replay the copy button is locked with every other control (the text itself stays selectable).
- `src/theme.css`: `.autopsy`, `.cause`, `.ruled` (bone border, `−` bone, `+` magic).
- `src/replay/`: `foldLine` already folds ritual events through `reduceRitual`; no change beyond a test.

## Tests

- Unit: `shared/autopsy` (reducer, guard, markdown), `server/diff`, `server/autopsy` (each kind on temp dirs; limits; symlink; deterministic), `ritual` (event order, swallowed failure, rejected grave), `scene`, `Autopsy` markup, `RaiseView` (section placement, absent without autopsy), replay timeline.
- Integration (`server/autopsy.integration.test.ts`): each prepared grave's real corpse/remedy dirs give the stated cause, and the seen flag matches the real failing output.

## Out of scope

- Agent-written explanations (KI), searching registries for the rotted dependency, sound (R10).

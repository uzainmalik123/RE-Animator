# Design: R6, the graveyard

## Overview

The graveyard is the idle stage of the app. The backend lists the prepared fixtures; the UI draws a headstone for each and a Kiro spirit that walks to the chosen one while the real ritual starts. Then the existing raise scene (R2) takes over on the same ritual handle.

```
GET /api/graveyard ─► Headstone[]          POST /api/rituals {grave:id | repo:url | -}
        │                                            │
  useGraveyard()                              useRitual().start(target)
        │                                            │
   <Graveyard> ── onRaise(target) ──► RaiseScene ────┘
        ▲                                │   view: 'graveyard' ─(accepted, walk done)► 'raise'
        └───────── onLeave ──────────────┘                     ◄─(Back to the graveyard)
```

## Shared (`shared/graveyard.ts`)

```ts
export interface Headstone { id: string; name: string; diedIn: number; licence: string; chart: boolean }
export const GRAVE_ID: RegExp;               // /^[a-z0-9][a-z0-9-]{0,63}$/
export function isGraveId(v: unknown): v is string;
export function byDeath(a: Headstone, b: Headstone): number;   // diedIn, then name
```

`id` is the fixture's directory name. `name` is the manifest's name (the repo, e.g. `guestbook-2016`).

## Backend

- `server/graveyard.ts`
  - `FIXTURES_DIR`: the `fixtures/` folder.
  - `listGraves(root = FIXTURES_DIR): Promise<Headstone[]>`: every subdirectory whose id matches `GRAVE_ID` and whose `loadFixture` succeeds; broken ones are skipped; sorted with `byDeath`.
  - `graveDir(id, root = FIXTURES_DIR): Promise<string | null>`: the directory of a listed grave, or null. It matches `id` against `GRAVE_ID` and the listing, so it never joins a user string onto a path.
- `server/ritual.ts`: `RitualRequest` gains `grave?: string`.
- `server/app.ts`: `createApp({ graveyard })` takes `graveyard?: { list(): Promise<Headstone[]> }`.
  - `GET /api/graveyard` → `{ graves }` (404-free; `[]` when none).
  - `POST /api/rituals`: `repo` (R9, unchanged) or `grave`; both → 400; `grave` not a string or not listed → 400 / 404 `no such grave`; accepted → `rituals.start({ grave })`.
- `server/main.ts`: the ritual's `fixture` factory: a `repo` clones as before; a `grave` loads `graveDir(grave)`; none loads `PRACTICE_CORPSE`. The `graveyard` dependency is `{ list: () => listGraves() }`.
- The recorder (R11) wraps `rituals.start(req)` already; it records `grave` requests like any other. The replay never needs the list.

## Fixtures

Three prepared graves, each dependency-free and written for this project (MIT), each with a chart (`requirements.md` + `routes.json`, D-R8):

| id | died | dies at | why | remedy |
|---|---|---|---|---|
| `practice-corpse` (`guestbook-2016`) | 2016 | install | `engines` pin with `engine-strict` | modern `engines`, `console.log` |
| `sundial-2015` | 2015 | build | `build.js` calls `util.print` (removed) | `process.stdout.write`, modern `engines` |
| `tally-2014` | 2014 | serve | `new process.EventEmitter()` (removed) | `require('events').EventEmitter`, modern `engines` |

## Frontend

- `src/graveyard/graveyardClient.ts`: `fetchGraveyard(fetchFn): Promise<{ graves: Headstone[] } | { error: string }>`.
- `src/graveyard/useGraveyard.ts`: `useGraveyard(): { graves: Headstone[] | null; error: string | null }`, loaded once on mount.
- `src/graveyard/scene.ts` (pure, like `raise/scene.ts`):
  - `WALK_MS = 1200`.
  - `slotX(i, n): number`: the headstone centres, in 0..1 of the width, evenly spread with margins.
  - `walkProgress(elapsedMs): number`: eased 0..1.
  - `stonesLuminance(cols, rows, { tMs, n, chosen }): Float32Array`: ground line, drifting fog (low, slow; bone ink), one tombstone per slot (the chosen one a touch brighter).
  - `kiroLuminance(cols, rows, { tMs, n, target, walkStartMs }): Float32Array`: a small spirit blob that bobs at the left when idle and glides to the target stone when walking (magic ink); `target` is null while idle.
  - Brightness follows only real state (which stone was chosen); time only drifts fog and bobs Kiro.
- `src/graveyard/Graveyard.tsx`: two stacked canvases (`bone`, `magic`) with `aria-label`s, the real-text list of stone buttons, the "Dig a new grave" form. Pure view of `{ graves, error, busy, error message, chosen, onRaise }`.
- `src/raise/ritualClient.ts`: `requestRitual(fetchFn, target?: RitualTarget)` where `RitualTarget = { repo: string } | { grave: string }`; 404 now also reads its `error`.
- `src/raise/useRitual.ts`: `start(target?) : Promise<boolean>` (true = accepted or rejoined), `reset()` (closes the stream, back to IDLE and id null).
- `src/raise/RaiseScene.tsx`: owns `view`. Starts in the graveyard (or the raise when `initial` pins a state, for tests). On a pick it calls `start`; on `true` with a headstone it sets `chosen` and, after `WALK_MS` (immediately under reduced motion), `view = 'raise'`; a URL grave goes straight to the raise. `onLeave` calls `reset()` and returns to the graveyard.
- `src/raise/RaiseView.tsx`: loses the "Name a grave" field and the Begin button (they live in the graveyard); gains `onLeave?: () => void` → "Back to the graveyard" (disabled while running). The replay passes no `onLeave`.
- `src/theme.css`: `.graveyard` (stage beside panel, stacked on phones), stone buttons in `--bone`, Kiro/the form in `--magic`, no red anywhere (red is Death's and wounds', THEME §4).

## Tests

- Unit: `shared/graveyard`, `server/graveyard` (list, order, skip broken, graveDir refuses traversal), `app` routes, `graveyardClient`, `ritualClient`, `scene`, `Graveyard` markup, `RaiseView` (back button), `App`.
- Integration (`server/graveyard.integration.test.ts`): each prepared grave really flatlines at its stated vital and really rises (real npm, real server, real Chromium), like `ritual.integration.test.ts`.

## Out of scope

- The cause-of-death text (R8), sound (R10), searching GitHub, and any hosted list of strangers' repos.

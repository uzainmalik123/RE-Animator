# R6 Graveyard Implementation Plan

> **For agentic workers:** use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. Built in Kiro (D-R18).

**Goal:** Replace the single "Begin the ritual" button with a graveyard of prepared dead repos; choosing one sends Kiro walking to its headstone and leads into the raise.

**Architecture:** The backend lists `fixtures/*` (`GET /api/graveyard`) and raises one by directory id (`POST /api/rituals {grave}`). The UI draws headstones with the R1 renderer (bone stones, magic Kiro), real buttons beneath. `RaiseScene` switches graveyard ⇄ raise on one ritual handle.

**Tech Stack:** TypeScript, Hono, React, Canvas 2D via `useDotCanvas`, Vitest.

**Spec:** `.kiro/specs/r6-graveyard/{requirements,design,tasks}.md`

## Global Constraints

- Node ≥ 22, ESM, pinned deps (add none). `npm run health` green after every task.
- Fresh code only (D-R2). Nothing faked (D-R11): the walk is a transition and reports nothing.
- `--magic` is Kiro/necromancy; `--bone` stones and fog; **no `--death` red** in the graveyard (THEME §4).
- Real text stays real text; every canvas has an `aria-label`; honour `prefers-reduced-motion`.
- Tests beside their code. The replay (R11) must not change.

## Review Focus

- A `grave` id like `../x`, `a/b`, `''`, `__proto__`, or a non-string never reaches the filesystem (Task 2, 3).
- A fixture dir with a broken manifest or a stray file in `fixtures/` doesn't crash the list (Task 2).
- Zero graves, one grave, many graves: the scene maths and the view don't divide by zero or overlap (Task 5, 6).
- A busy backend (409 rejoin), a 404 and a dead backend show a reason and play no walk (Task 4, 7).
- Leaving mid-walk or unmounting during the walk never starts a stale timer or a second ritual (Task 7).
- "Back to the graveyard" while a ritual is running is impossible (Task 7).

---

### Task 1: Two more prepared graves

**Files:** Create `fixtures/sundial-2015/**`, `fixtures/tally-2014/**` (done: manifest, corpse, remedy, chart each). Test: `server/graveyard.integration.test.ts`.

**Interfaces:** Produces fixtures whose `loadFixture(dir)` succeeds with `chartDir !== null`.

- [x] **Step 1:** Write both fixtures (sundial dies at build via `util.print`; tally at serve via `process.EventEmitter`), each with a chart.
- [ ] **Step 2: Integration test** `each prepared grave flatlines at its vital and rises`, table of `[dir, deathVital]` = `[practice-corpse, install]`, `[sundial-2015, build]`, `[tally-2014, serve]`: run the real `Rituals` (as `ritual.integration.test.ts` does) on each; assert the corpse's first failing vital is the stated one, the log ends `risen`, and all four revived vitals ok.
- [ ] **Step 3:** `npx vitest run server/graveyard.integration.test.ts` → PASS.
- [ ] **Step 4: Commit** `R6: two more prepared graves`.

### Task 2: Headstone type and `listGraves` / `graveDir`

**Files:** Create `shared/graveyard.ts`, `shared/graveyard.test.ts`, `server/graveyard.ts`, `server/graveyard.test.ts`.

**Interfaces:** Produces `Headstone`, `GRAVE_ID`, `isGraveId(v: unknown): v is string`, `byDeath(a,b)`; `FIXTURES_DIR`, `listGraves(root?: string): Promise<Headstone[]>`, `graveDir(id: string, root?: string): Promise<string | null>`.

- [ ] **Step 1: Tests.** shared: `isGraveId` accepts `sundial-2015`, rejects `''`, `'../x'`, `'a/b'`, `'A'`, `'__proto__'`-like uppercase/underscore, 65 chars, non-strings; `byDeath` orders 2014 < 2015 < 2016 and ties by name. server (temp `root` with fake fixtures): lists in `byDeath` order with `chart` true only when `chart/requirements.md` exists; skips a dir with a bad manifest, a stray file, and a name failing `GRAVE_ID`; the real `FIXTURES_DIR` lists exactly `guestbook-2016, sundial-2015, tally-2014`-by-name in order 2014, 2015, 2016 with ids `tally-2014, sundial-2015, practice-corpse`; `graveDir('practice-corpse')` ends with `fixtures/practice-corpse`, `graveDir('../fixtures')`, `graveDir('nope')` → `null`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement with `readdir(root, {withFileTypes})` + `loadFixture`; `Headstone.id` = dir name.
- [ ] **Step 4:** Run → PASS. **Step 5: Commit** `R6: the graveyard's list`.

### Task 3: The API

**Files:** Modify `server/app.ts`, `server/ritual.ts` (`RitualRequest.grave?`), `server/main.ts`; Test `server/app.test.ts`.

**Interfaces:** Consumes Task 2. Produces `createApp({ graveyard?: { list(): Promise<Headstone[]> } })`.

- [ ] **Step 1: Tests (fake rituals).** `GET /api/graveyard` → 200 `{graves}`; absent dep → route missing is fine (404). `POST {grave:'tally-2014'}` → 202 and `rituals.start` got `{grave:'tally-2014'}`; `{grave:'nope'}` → 404 `no such grave`; `{grave:5}`, `{grave:'../x'}` → 400; `{grave:'a', repo:'https://github.com/o/r'}` → 400; `{}` and no body → `start({})`; the loopback guard covers the new route.
- [ ] **Step 2:** FAIL. **Step 3:** Implement in `app.ts`; in `main.ts` resolve `req.grave` through `graveDir` (throw `GraveError`-free `Error('no such grave')` if null) before `loadFixture`.
- [ ] **Step 4:** PASS. **Step 5: Commit** `R6: GET /api/graveyard and raising a grave by id`.

### Task 4: Client plumbing

**Files:** Modify `src/raise/ritualClient.ts` (+test), `src/raise/useRitual.ts`; Create `src/graveyard/graveyardClient.ts` (+test), `src/graveyard/useGraveyard.ts`.

**Interfaces:** Produces `type RitualTarget = { repo: string } | { grave: string }`; `requestRitual(fetchFn, target?: RitualTarget)`; `fetchGraveyard(fetchFn): Promise<{graves: Headstone[]} | {error: string}>`; `RitualHandle.start(target?): Promise<boolean>`, `RitualHandle.reset(): void`; `useGraveyard(): {graves: Headstone[] | null; error: string | null}`.

- [ ] **Step 1: Tests.** `requestRitual` posts `{grave}` / `{repo}` JSON, no body for none; 404 and 400 surface the server's `error`; a thrown fetch → the "not answering" error. `fetchGraveyard` returns graves; non-200 or thrown → `{error}`; malformed body → `{error}`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement; `useRitual.start` returns `false` on error and `true` otherwise; `reset` closes the source, sets IDLE, id null, error null. Update existing `ritualClient.test.ts` and the replay's `start` (`async () => false`).
- [ ] **Step 4:** PASS (`npm run typecheck` too). **Step 5: Commit** `R6: the client asks for graves by id`.

### Task 5: Scene maths

**Files:** Create `src/graveyard/scene.ts`, `src/graveyard/scene.test.ts`.

**Interfaces:** Produces `WALK_MS = 1200`, `slotX(i: number, n: number): number`, `walkProgress(elapsedMs: number): number`, `stonesLuminance(cols, rows, o: {tMs: number; n: number; chosen: number | null}): Float32Array`, `kiroLuminance(cols, rows, o: {tMs: number; n: number; target: number | null; walkMs: number}): Float32Array`.

- [ ] **Step 1: Tests.** `slotX`: strictly increasing, within (0,1), `n=1` → 0.5, `n=0` → no throw; `walkProgress(0)=0`, `(WALK_MS)=1`, clamped outside, monotone; `stonesLuminance`: length `cols*rows`, values within 0..1, deterministic for equal args, zero-size → empty, `n=0` still draws the ground; a chosen stone's cells are at least as bright as the unchosen at the same position; `kiroLuminance`: idle blob is in the left third; at `walkMs >= WALK_MS` its centre of mass is within 2 cells of the target slot; `target=null` ignores `walkMs`; never NaN.
- [ ] **Step 2:** FAIL. **Step 3:** Implement (headstone = rounded top + body; ground = bottom band; fog = two sine-drift bands; Kiro = soft disc with a trailing tail, bobbing).
- [ ] **Step 4:** PASS. **Step 5: Commit** `R6: the graveyard's imagery`.

### Task 6: The `Graveyard` view

**Files:** Create `src/graveyard/Graveyard.tsx`, `src/graveyard/Graveyard.test.tsx`; Modify `src/theme.css`.

**Interfaces:** Consumes Task 4–5. Produces `Graveyard({ graves, error, loadError, chosen, busy, onRaise })` where `graves: Headstone[] | null`, `chosen: string | null` (grave id), `onRaise(t: RitualTarget): void`; and `graveRequest(text: string): string | null` (trimmed URL or null).

- [ ] **Step 1: Tests (static markup).** Loading (`graves=null`) says the graveyard is waking, no buttons; `loadError` is shown as text; zero graves says none are buried and still offers the form; with three graves: one `<button>` each in a `<ul>`, text has name, "died 2014", licence, and "Death can attack" / "no chart"; canvases carry `aria-label`; the dig button is `disabled` when the field is empty (`graveRequest('  ')` → null); `busy` disables every button; no `death` class or red token appears.
- [ ] **Step 2:** FAIL. **Step 3:** Implement with two `useDotCanvas` canvases (`bone`: stones, `magic`: Kiro); walking when `chosen` is set (record `performance.now()` at the choice via a ref). CSS: `.graveyard` mirrors `.raise` layout; stacked on phones.
- [ ] **Step 4:** PASS. **Step 5: Commit** `R6: the graveyard view`.

### Task 7: Wire the flow

**Files:** Modify `src/raise/RaiseScene.tsx`, `src/raise/RaiseView.tsx`, `src/App.test.tsx`, `src/raise/RaiseView.test.tsx`, `src/raise/RaiseScene.test.tsx`, `src/replay/ReplayScene.tsx`.

**Interfaces:** `RaiseView` gains `onLeave?: () => void`; loses the grave field, Begin button and `graveRequest` (moved to Task 6).

- [ ] **Step 1: Tests.** `App` opens on the graveyard ("The graveyard" heading, "Dig a new grave"); `RaiseView` with `onLeave` shows "Back to the graveyard", disabled while examining/raising, enabled when risen/failed; without `onLeave` (replay) it shows no such button and no grave field; `RaiseScene` with `initial` pinned shows the raise, not the graveyard. Extract the scene's decision into a pure `nextView` or equivalent and test: accepted headstone pick → walking then raise after `WALK_MS`; reduced motion → raise at once; rejected start → stays; URL grave → raise at once; leave → graveyard with the ritual reset; a pending walk timer is cleared on leave/unmount.
- [ ] **Step 2:** FAIL. **Step 3:** Implement.
- [ ] **Step 4:** `npm run health` → green. **Step 5: Commit** `R6: pick a grave, watch Kiro fetch it, raise it`.

### Task 8: Close

**Files:** Modify `docs/PRD.md`, `docs/DECISIONS.md` (D-R24), `docs/KNOWN_ISSUES.md`, `.kiro/specs/reanimator/tasks.md`, `.kiro/specs/r6-graveyard/tasks.md`, `README.md`, `AGENTS.md`; Create `docs/img/r6-graveyard.png`.

- [ ] **Step 1:** Run the real backend and the dev server; screenshot the graveyard with Chromium; click a stone and confirm the walk then the raise (the real thing, not a mock).
- [ ] **Step 2:** Update docs and tick both `tasks.md` lists.
- [ ] **Step 3:** `npm run health` → green; quote it. **Step 4: Commit** `R6: docs, decisions, known issues`.

# R4 The Attack Scene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When Death is summoned, the raise stage becomes a dot-matrix attack scene: the app (the engine's own real frames of it) in `--bone`, Death and his minions in `--death` at the ghosts' real positions, and a wound where each reproduced finding landed.

**Architecture:** The R3 tail forwards four more engine facts (`ghost.spawned`, `ghost.step` with `x,y`, `rep.finished`, and throttled frame marks from `frames.ndjson`). `reduceAttack` folds them into `ghosts`. A new backend route serves a frame jpg from the run dir. A pure `src/attack/scene.ts` turns state into luminance grids and label positions; `AttackScene.tsx` draws them through the R1 renderer on two one-ink canvases.

**Tech Stack:** TypeScript, React 19, Canvas 2D through `src/render/` (R1), Hono, vitest.

**Spec:** `docs/PRD.md` § R4, `docs/THEME.md` §4–6 and §9, `.kiro/specs/reanimator/requirements.md` Req 2.3, 2.4 and 4, and the R4 grill (Q1–Q12, recorded as D-R19).

## Global Constraints

- `--death` only for Death, minions, wounds and the vignette; `--bone` for the app's body; never `--magic` in the attack scene (THEME §4, Req 4.2).
- One ink per canvas (the RaiseScene pattern).
- Real text stays text: wound labels are HTML, never dots (Req 4.3).
- `prefers-reduced-motion`: no ramp, no trail, no drift; one still frame per state change (Req 4.4).
- Nothing faked (D-R11): minion positions are real `ghost.step` x,y; wounds come only from the report's haunted pairs; the body is only real engine frames, and there's no body before the first one.
- Don't re-implement Poltergeist; don't import `@poltergeist/core` (D-R16). The engine's viewports are restated as constants: `lich` 360×640, everything else Playwright's default 1280×720.
- Frame marks: at most 1 per second per ghost (by the mark's `t`).
- Visible minions: at most 12.
- `npm run health` green after every task.

## Review Focus

- **A frame request with a hostile ghostId or seq** (`..`, `/`, `%2F`, a negative or non-integer seq): it must be a 404 and never read outside `<runDir>/frames/`. Tested in Task 2.
- **An engine event missing fields** (the stub's `ghost.step` with no `ghostId`, or x/y that aren't numbers): drop it, or keep it without a position, and never crash the reducer. Tested in Task 1.
- **A ghost.step for a ghost never spawned** (an `--only` re-run, a resume mid-stream): ignored. Tested in Task 1.
- **A frame that fails to load** (404, a run dir already gone after a new ritual): the body keeps the previous image, with no exception. Tested in Task 4 (the loader keeps the last good image).
- **Zero-size grid or a canvas that isn't laid out yet** (cols or rows = 0): every luminance function returns an empty array. Tested in Task 3.

---

### Task 1: The protocol carries ghosts and frames

**Files:**
- Modify: `shared/attack.ts`, `shared/attack.test.ts`
- Modify: `server/engine.ts` (`toEngineEvent`, tailer, `runEngine` adds `onRun`), `server/engine.test.ts`, `server/test-engine.mjs`

**Interfaces:**
- Produces (in `shared/attack.ts`):
  - `EngineEvent` gains:
    - `{ type: 'ghost.spawned'; ghostId: string; criterion: string; persona: string; rep: number }`
    - `{ type: 'ghost.step'; ghostId: string; x?: number; y?: number }`
    - `{ type: 'rep.finished'; rep: number }`
    - `{ type: 'frame'; ghostId: string; seq: number }`
  - `interface Ghost { ghostId; criterion; persona; rep; x?: number; y?: number; trail: {x:number;y:number}[] /* the last 3 earlier positions, oldest first */; done: boolean; frame?: number }`
  - `AttackState.ghosts: Record<string, Ghost>` (`QUIET.ghosts = {}`)
- Produces (in `server/engine.ts`): `runEngine` option `onRun?: (runDir: string) => void`, called once when the run dir appears.

- [ ] **Step 1: Failing tests in `shared/attack.test.ts`**
  - `tracks a ghost from spawn to done`: spawned → step(10,20) → step(30,40) → frame seq 2 → `rep.finished` rep 1. Expect `ghosts.g1` toEqual `{ghostId:'g1',criterion:'1.2',persona:'wraith',rep:1,x:30,y:40,trail:[{x:10,y:20}],done:true,frame:2}`.
  - `keeps only the last 3 trail points`: 5 steps → `trail.length === 3`, and it ends with the 4th position.
  - `a step without a position keeps the old one`: step(5,5), then a step with no x,y → x,y stay 5,5 and the trail is unchanged.
  - `ignores steps and frames for an unknown ghost`: the state is returned unchanged (`toBe` the same object).
  - The existing `starts fresh on a new summon` keeps passing (`ghosts: {}`).
- [ ] **Step 2: Run** `npx vitest run shared/attack.test.ts`. Expect it to FAIL on `ghosts` undefined.
- [ ] **Step 3: Implement** the types and the `reduceEngine` cases in `shared/attack.ts`. `rep.finished` marks every ghost with that `rep` as `done`.
- [ ] **Step 4: Failing tests in `server/engine.test.ts`**
  - Update the stub to also write `ghost.spawned` `{ghostId:'g1',criterion:'1.2',persona:'wraith',rep:1,actor:'a'}`, a `ghost.step` `{ghostId:'g1',index:0,step:'click',outcome:'ok',x:3,y:4}`, and `frames.ndjson` with three marks for g1 at t=1000, 1500 and 2100 (seq 0, 1, 2). Keep the existing malformed `{ghost:'g'}` step.
  - The first test's `seen` gains, in this order after the plan event: `{type:'ghost.spawned',ghostId:'g1',criterion:'1.2',persona:'wraith',rep:1}`, `{type:'ghost.step',ghostId:'g1',x:3,y:4}`, then frames seq 0 and seq 2 (seq 1 is dropped by the 1-second throttle). The malformed step is dropped. Interleaving between the two files may vary, so assert the events from `events.ndjson` in order and the frame marks separately (filter by type).
  - `toEngineEvent` unit cases: `ghost.step` with `x:'3'` keeps no x/y; a `ghost.spawned` with no ghostId returns null.
  - `calls onRun with the run dir`: `onRun` receives `join(home,'.poltergeist','runs','stub-1')`.
- [ ] **Step 5: Run** `npx vitest run server/engine.test.ts`. Expect FAIL.
- [ ] **Step 6: Implement** it in `server/engine.ts`. Generalise the tailer into a per-file line tail (the same whole-lines/partial logic), run on `events.ndjson` and `frames.ndjson` of the found run dir. Frame lines `{ghostId, seq, t}` go through a per-ghost throttle (`t - lastForwarded >= 1000`). `onRun` fires when the fresh dir is found.
- [ ] **Step 7: Run** `npx vitest run shared server`. Expect PASS. Then `npm run health`.
- [ ] **Step 8: Commit** `R4: the attack stream carries ghosts, their positions and frame marks`

### Task 2: The backend serves frames

**Files:**
- Modify: `server/attack.ts` (records `runDir` via `onRun`; adds `frame()`), `server/attack.test.ts`
- Modify: `server/app.ts` (route), `server/app.test.ts`

**Interfaces:**
- Produces: `Attacks.frame(id: string, ghostId: string, seq: number): Promise<Buffer | null>`. It returns null unless `id` is the current attack, its run dir is known, `ghostId` matches `/^[A-Za-z0-9._-]+$/` and isn't `.`/`..`, `seq` is a safe non-negative integer, and the file `<runDir>/frames/<ghostId>/<seq padded to 5>.jpg` exists.
- Produces: `GET /api/attacks/:id/frames/:ghostId/:seq` → `200 image/jpeg` with `cache-control: no-store`, else `404 {error:'no such frame'}`. `AttacksApi` adds `'frame'`.

- [ ] **Step 1: Failing tests**
  - `server/attack.test.ts`, `serves a frame of the current run`: the fake engine calls `o.onRun(dir)` after writing `dir/frames/g1/00002.jpg`. Then `a.frame(id,'g1',2)` returns those bytes, and `a.frame(id,'..',2)`, `a.frame(id,'g1',-1)`, `a.frame(id,'g1',1.5)`, `a.frame('other','g1',2)` and `a.frame(id,'g1',3)` all return null.
  - `server/app.test.ts`: the fake `frame` returns a Buffer for `('a1','g1',2)` and null otherwise. GET `/api/attacks/a1/frames/g1/2` → 200 with `content-type` `image/jpeg`. `/frames/g1/x` → 404. `/frames/..%2Fx/2` → 404.
- [ ] **Step 2: Run** `npx vitest run server/attack.test.ts server/app.test.ts`. Expect FAIL.
- [ ] **Step 3: Implement.** In `app.ts`, parse seq with `Number` and pass it through; validation lives in `Attacks.frame`. A missing file is null, not a throw.
- [ ] **Step 4: Run** the same tests (PASS), then `npm run health`.
- [ ] **Step 5: Commit** `R4: serve the engine's frames of the app under attack`

### Task 3: The scene's pure imagery and layout

**Files:**
- Create: `src/attack/scene.ts`, `src/attack/scene.test.ts`
- Create: `public/art/death.svg` (a hand-made reaper silhouette, hood and scythe, white on transparent, 240×360 viewBox, a comment with its origin and licence like `sample-headstone.svg`)

**Interfaces:**
- Produces (all pure and deterministic, from `src/attack/scene.ts`):
  - `VIEWPORTS: Record<string, {width:number;height:number}>` = `{ lich: {360,640} }` and `DEFAULT_VIEWPORT = {width:1280,height:720}`; `viewportOf(persona: string)`.
  - `MINION_SPRITES: Record<string, string[]>`: the six THEME §6 drafts (wraith, banshee, doppelganger, lich, revenant, changeling), each an array of 4 lines. `spriteLuminance(lines: string[]): {cols:number; rows:number; lum: Float32Array}`: a non-space char is 1, a space is 0.
  - `type Rect = {x:number;y:number;w:number;h:number}` (in cells).
  - `placeOnBody(body: Rect, persona: string, x: number, y: number): {col:number; row:number}` = body origin + (x / vw) · body.w, clamped inside the body.
  - `idleSpot(i: number, cols: number, rows: number): {col;row}`: a fixed slot along the bottom edge for the i-th unpositioned ghost.
  - `watchedGhost(s: AttackState): string | null`: running → the earliest-spawned (insertion order) ghost that isn't done and has a `frame`. Finished → the ghost with the first wound's criterion and persona that has a frame, else the last ghost with a frame. Otherwise null.
  - `woundSpot(w: Wound, s: AttackState): {x:number;y:number;persona:string} | null`: the positioned ghost with the same criterion and persona (the highest rep wins), else null.
  - `vignetteLuminance(cols, rows, strength: number /*0..1*/): Float32Array`: 0 in the centre, rising toward the edges (`strength · smoothstep(0.55, 1, r)`, with r the normalised distance to the nearest edge).
  - `deathLayer(cols, rows, o: { strength: number; minions: {col:number;row:number;persona:string;trail:{col:number;row:number}[]}[]; wounds: {col:number;row:number}[]; death: Float32Array | null; deathRect: Rect | null }): Float32Array`: the vignette, max-composited with the Death image into `deathRect`, the sprites (1.0) with trail copies at 0.5/0.3/0.15 of the sprite's brightness, and wound gashes (a 9×3 cell band of 1/0.66/0.33, the ▓▒░ steps).
  - `ATTACK_RAMP_MS = 1500`; `arrival(tMs: number, startMs: number, reduceMotion: boolean): number` (1 if reduceMotion, else clamp((t-start)/1500)).
  - `sceneLabel(s: AttackState): string` → `Death attacks: ${n} minion(s), ${m} wound(s)`. n = ghosts not done (finished → 0); "Death waits" when idle; on a failed attack, `Death faltered`.

- [ ] **Step 1: Failing tests in `src/attack/scene.test.ts`**
  - `spriteLuminance` of `['a b']` → cols 3, rows 1, lum `[1,0,1]`; each of the six sprites has 4 rows.
  - `placeOnBody({x:10,y:5,w:64,h:36},'wraith',640,360)` → `{col:42,row:23}`; for `'lich'`, (180,320) → the middle; x beyond the viewport is clamped to `body.x+body.w-1`.
  - `watchedGhost`: two running ghosts, the first with no frame → the second; both done and finished with a wound on g2's pair → g2.
  - `woundSpot`: picks the rep-2 ghost over rep-1; no match → null.
  - `vignetteLuminance(20,10,1)` centre is 0 and corner > 0.9; strength 0 → all 0; `(0,10,1)` → length 0.
  - `deathLayer` is deterministic (two calls equal); a wound at (5,5) lights cell (5,5) at 1; cols 0 → empty.
  - `arrival(750,0,false)` = 0.5; `arrival(0,0,true)` = 1.
  - `sceneLabel` for 1 live ghost and 1 wound: `Death attacks: 1 minion, 1 wound`.
- [ ] **Step 2: Run** `npx vitest run src/attack/scene.test.ts`. Expect FAIL.
- [ ] **Step 3: Implement** `src/attack/scene.ts`, and draw `public/art/death.svg`.
- [ ] **Step 4: Run** (PASS), then `npm run health`.
- [ ] **Step 5: Commit** `R4: the attack scene's imagery as pure luminance`

### Task 4: AttackScene on the stage, the panel on shared state

**Files:**
- Create: `src/attack/AttackScene.tsx`, `src/attack/AttackScene.test.tsx`, `src/attack/useImage.ts`
- Modify: `src/attack/useAttack.ts` (reset on a new ritualId), `src/attack/AttackPanel.tsx` (takes `attack` as a prop), `src/attack/AttackPanel.test.tsx`
- Modify: `src/raise/RaiseScene.tsx` (calls `useAttack(live.id)`; the stage shows `AttackScene` once `attack.state.status !== 'idle'`), `src/raise/RaiseScene.test.tsx`, `src/theme.css`

**Interfaces:**
- Consumes: Task 1 `AttackState.ghosts`; Task 2's frame URL; everything in Task 3.
- Produces:
  - `useImage(url: string | null): HTMLImageElement | null`: loads the URL and returns the last image that loaded. A failed load keeps the previous one.
  - `frameUrl(attackId: string, ghostId: string, seq: number): string` → `/api/attacks/${enc(id)}/frames/${enc(ghostId)}/${seq}` (in `attackClient.ts`). `useAttack` now also returns `id: string | null` (the attack id).
  - `AttackPanel({ attack }: { attack: { state: AttackState; summon: () => Promise<void>; error: string | null } })`.
  - `AttackScene({ state, attackId }: { state: AttackState; attackId: string | null })`: a `.attack-stage` wrapper with two stacked canvases (`.attack-body` in `bone`, `.attack-death` in `death`) and an `<ol className="attack-wounds">` of absolutely positioned `<li>` labels `${criterion} · ${persona}` (percent left/top from the wound's cell). The wrapper has `role="img"` and `aria-label={sceneLabel(state)}`.
- Drawing: generalise RaiseScene's `useDotCanvas` into `src/render/useDotCanvas.ts` (moved, exported; RaiseScene imports it) so both scenes share it. The body layer samples the watched frame with `sampleLuminance` into the `containRect` of the frame inside the grid, and is empty without a frame. The death layer is `deathLayer(...)`, with Death's image (from `useImage('/art/death.svg')`) in the top-centre third. Strength = `0.6 · arrival` (finished/failed: 0.35). Minion trails only when motion is allowed.

- [ ] **Step 1: Failing tests**
  - `AttackScene.test.tsx` (SSR, `renderToStaticMarkup`): an attacking state with one positioned ghost → it has `aria-label="Death attacks: 1 minion, 0 wounds"` and two `<canvas`. A finished state with one wound whose ghost sat at (640,360) → the label text `1.2 · wraith` is inside `attack-wounds` with `left:50%`.
  - `AttackPanel.test.tsx`: update it to pass `attack={{ state, summon, error: null }}`; the existing assertions stay.
  - `RaiseScene.test.tsx`: the risen state still contains `Summon Death` and the spell-circle canvas (an idle attack keeps the raise stage).
- [ ] **Step 2: Run** `npx vitest run src`. Expect FAIL.
- [ ] **Step 3: Implement.** CSS: `.attack-stage { position: relative }`, both canvases absolutely fill it, `.attack-wounds li { position:absolute; color: var(--death); font: 12px JetBrains Mono; transform: translate(-50%, -150%) }`. With `prefers-reduced-motion` there's no transition; otherwise `.attack-stage` fades in from opacity 0 over 400 ms (eyes opening, THEME §5).
- [ ] **Step 4: Run** `npx vitest run src` (PASS), then `npm run health`.
- [ ] **Step 5: Check it in the browser:** `npm run server` + `npm run dev`. Raise, then Summon Death with no key: the scene should come up (vignette and Death) and then show `Death faltered`. Take a screenshot into `docs/img/r4-attack-arrival.png`.
- [ ] **Step 6: Commit** `R4: the attack scene, Death and his minions over the app`

### Task 5: Close the cycle (docs)

**Files:** `docs/PRD.md` (R4 → `Built; filming pending KI-R15`, a Built note, a changelog line), `.kiro/specs/reanimator/tasks.md` (task 5's sub-notes), `docs/DECISIONS.md` (D-R19, from the grill Q1–Q12), `docs/KNOWN_ISSUES.md` (KI-R17: the restated engine viewports can drift from Poltergeist's; KI-R18: R4 review minors, if any), `AGENTS.md` (Do first / state), the repo-root `AGENTS.md` state line.

- [ ] **Step 1:** Write the docs above.
- [ ] **Step 2:** Run `npm run health`. Expect it green.
- [ ] **Step 3: Commit** `R4: docs, decisions, known issues`

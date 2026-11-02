# F16 Extended Personas: Lich & Revenant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Lich (slow, small device) and Revenant (stale session) personas, with fixed device emulation, an origin-scoped `logout`, and a deterministic "unusable target" app failure, so a slow-device breakage can be `haunted` (KI-39).

**Architecture:** Personas stay plain data in `personas/registry.ts`; a persona may carry a fixed `device` preset (`personas/devices.ts`). The runner applies the preset to each actor's guarded context (viewport, mobile, touch) and page (CDP CPU throttling). When a device persona's action step times out on a target that exists but is hidden or off-screen, the actor records `unusable` on the step and `runPair` turns the rep into `completed` with one synthetic failing app assertion, so F07's existing verdict rules apply unchanged.

**Tech Stack:** TypeScript (Node ≥ 22, ESM), playwright-core 1.64 (Chromium, CDP), zod 4, vitest.

**Spec:** `.kiro/specs/poltergeist/requirements.md` Req 4, 6, 7; PRD § F16; grill decisions D-44 (this plan's Task 5 writes it).

## Global Constraints

- Plain QA wording in `behaviour` (D-09): no theme words (`test/helpers/theme-words.ts` checks).
- Device presets are fixed; the LLM never chooses a viewport or CPU rate. Network throttling stays the DSL `throttle` step (`slow-3g`, `fast-3g`).
- Lich device: viewport 360×640, `isMobile: true`, `hasTouch: true`, `deviceScaleFactor: 1`, CPU slowdown 4.
- Revenant never touches cookies outside the target origin: `logout` clears cookies for the target hostname only, and storage only when the page is on the target origin.
- Every context is still created through `newGuardedContext` (D-18, D-22).
- Timeouts stay `inconclusive` (D-34) except the one `usable` case below; a disabled or missing target stays `timeout`.
- Health: `npm run health` green after every task.

## Review Focus

- A Lich click that times out because the button is disabled while a slow request is in flight → must stay `timeout`, not `usable` (Task 3 test).
- A target that never appears (count 0) on a slow network → stays `timeout` (Task 3 test).
- `logout` on a page sitting on another allowed loopback origin → must not clear that origin's storage or other hosts' cookies (Task 2 test).
- A plan timeout (60 s) during a device persona's step → stays `timeout`; only step timeouts are probed (Task 4 test).
- `--personas wraith` still runs only the Wraith; the default now runs all five (Task 5 test).

---

### Task 1: Personas and device presets

**Files:**
- Create: `packages/core/src/personas/devices.ts`
- Modify: `packages/core/src/personas/registry.ts`, `packages/core/src/personas/index.ts`
- Test: `packages/core/test/personas/registry.test.ts`

**Interfaces:**
- Produces: `type DeviceId = 'small-slow'`; `type DevicePreset = { readonly id: DeviceId; readonly viewport: { width: number; height: number }; readonly isMobile: boolean; readonly hasTouch: boolean; readonly cpuSlowdown: number; readonly label: string }`; `getDevice(id: DeviceId): DevicePreset`; `Persona.device?: DeviceId`; `PERSONA_IDS = ['wraith','banshee','doppelganger','lich','revenant']`.

- [ ] **Step 1: Tests** in `registry.test.ts`: `listPersonas` ids/names are the five in order (`Lich`, `Revenant`); allocation tests:
  - lich: `allowedSteps` `['goto','click','fill','press','back','reload','wait','throttle']`, generators `['plain']`, actors 1, `device` `'small-slow'`.
  - revenant: `allowedSteps` `['goto','click','fill','press','back','reload','wait','barrier','login','logout']`, generators `['plain']`, actors 2, no `device`.
  - `getDevice('small-slow')` equals `{ id:'small-slow', viewport:{width:360,height:640}, isMobile:true, hasTouch:true, cpuSlowdown:4, label:'360×640 phone, 4× slower CPU' }` and is frozen.
  - The existing theme-word and integrity tests cover the new behaviour text.
- [ ] **Step 2:** Run `npx vitest run packages/core/test/personas` → FAIL.
- [ ] **Step 3:** Implement. Lich behaviour: a user on a slow, small phone (narrow screen, slow processor) who first slows the network with `throttle`, then uses the page; checks controls stay reachable and usable on the small screen, loading states show, and nothing breaks or submits twice on a slow connection. Revenant behaviour: the same signed-in user in two tabs; tab b ends the session (the app's own sign-out control, or `logout`, which drops that tab's session cookies) and tab a then continues on its stale page; checks the app sends the user to sign in again (or refuses clearly) rather than acting, crashing or showing private data. Taglines are UI copy. Update registry doc comment.
- [ ] **Step 4:** Rerun → PASS; then `npm run health` and fix any test that hard-codes three personas (summon/cli/mcp/compile done-when with the fake LLM) only by updating its expected persona lists.
- [ ] **Step 5:** Commit `F16: Lich and Revenant personas, small-slow device preset`.

### Task 2: Origin-scoped `logout`

**Files:**
- Modify: `packages/core/src/runner/actor.ts` (the `logout` branch)
- Test: `packages/core/test/runner/actor.test.ts`

**Interfaces:** consumes `ActorEnv.origin`.

- [ ] **Step 1: Test** `logout clears only the target origin's cookies and storage`: context seeded with the fixture session plus a cookie for domain `other.test`; page on the target sets `localStorage.k`; run `[{goto:'/claims'},{logout:true}]`; expect `context.cookies()` has no cookie for the target hostname and still has the `other.test` cookie; target `localStorage.k` is gone.
- [ ] **Step 2:** Run → FAIL (other cookie cleared).
- [ ] **Step 3:** `await context.clearCookies({ domain: new URL(env.origin).hostname })`; run the storage clear only when `new URL(page.url()).origin === new URL(env.origin).origin`.
- [ ] **Step 4:** Run → PASS. Commit `F16: logout touches only the target origin`.

### Task 3: Device emulation in the actor + unusable-target probe

**Files:**
- Create: `packages/core/src/runner/device.ts`
- Modify: `packages/core/src/runner/actor.ts`, `packages/core/src/runner/types.ts`
- Test: `packages/core/test/runner/device.test.ts`

**Interfaces:**
- Produces: `deviceContextOptions(d: DevicePreset): Pick<BrowserContextOptions,'viewport'|'isMobile'|'hasTouch'|'deviceScaleFactor'>`; `applyDevice(page: Page, d: DevicePreset): Promise<void>` (CDP `Emulation.setCPUThrottlingRate`); `probeUsable(page: Page, target: PlanTarget, viewport: {width:number;height:number}): Promise<string | undefined>` — returns a reason when the first match exists but is not visible, or its box lies outside `[0, viewport.width)` horizontally; `undefined` when missing, visible-in-viewport, or disabled; never throws (1 s internal timeouts).
- `ActorEnv.device?: DevicePreset`; `StepResult.unusable?: string`.

- [ ] **Step 1: Tests** (`device.test.ts`, a tiny `page.setContent` per case, context from `newGuardedContext` with `deviceContextOptions`):
  - `probeUsable` returns a reason containing `not visible` for a `display:none` button; one containing `off-screen` for a button at `margin-left:800px`; `undefined` for a visible button, a `disabled` button, and a missing target.
  - `startActor` with `device` set and `stepTimeoutMs: 500`: clicking a hidden button ends `timeout` with `steps[0].unusable` set; clicking a `disabled` visible button ends `timeout` with no `unusable`; without `device`, a hidden button gives no `unusable`.
  - `deviceContextOptions(getDevice('small-slow'))` yields viewport 360×640 and `page.viewportSize()` matches.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement; in `startActor`, call `applyDevice` once before the first step when `env.device` is set; in the catch, when the error is a timeout, `env.device` is set and the step is `click`/`dblclick`/`fill`, set `result.unusable = await probeUsable(...)` (redacted).
- [ ] **Step 4:** Run → PASS. Commit `F16: device emulation and unusable-target probe`.

### Task 4: Runner wiring — device contexts and the `usable` assertion

**Files:**
- Modify: `packages/core/src/runner/run.ts`
- Test: `packages/core/test/runner/run.test.ts` (claims fixture)

**Interfaces:** consumes Tasks 1 and 3. Produces the synthetic assertion `{ index: plan.assert.length, type: 'usable', ok: false, failure: 'app', detail: '<step.unusable> (<device.label>)' }`.

- [ ] **Step 1: Tests:**
  - A `lich` plan clicking a target hidden on the fixture (add a `/narrow` page to `claims-fixture.ts`: a button hidden under `@media (max-width: 600px)`), `stepTimeoutMs` small: every rep is `completed` with that one failing `usable` assertion, and `computeVerdicts` gives `haunted`.
  - The same plan as `wraith` (no device): rep `completed` and clean (button visible at the default viewport).
  - A `lich` plan whose step hits the plan timeout (small `planTimeoutMs`, `wait`) stays `timeout`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** In `runPair`, look up `getPersona(plan.persona).device`; pass `deviceContextOptions` into `newGuardedContext`'s extra options and `device` into `startActor`. After outcome resolution: if the outcome is a step `timeout` (not `timedOut`) and the timed-out step has `unusable`, set outcome `completed`, no error, and `result.assertions = [synthetic]` (assertions are not run).
- [ ] **Step 4:** Run → PASS; `npm run health`. Commit `F16: device personas run emulated; unusable target is an app failure (KI-39)`.

### Task 5: Spec, docs and done-when

**Files:**
- Test: `packages/core/test/compiler/done-when.test.ts` (or a new `test/personas/done-when.test.ts`): the fake LLM compiles ≥3 fixture criteria for `lich` and `revenant` into valid plans that pass `validatePlan` (lich uses `throttle`; revenant has actors a and b with a `logout` or sign-out click in b).
- Modify: `.kiro/specs/poltergeist/requirements.md` (Req 4: five built-in personas + Changeling later; add Req 6.9 device emulation; Req 7 criterion: unusable target on a device persona counts as an app failure), `design.md` (persona table/runner note), `docs/DECISIONS.md` (D-44), `docs/KNOWN_ISSUES.md` (KI-39 Resolved; new KI: real Candy Swap done-when; new KI: desktop-only Scout → false `usable` on responsive menus), `docs/PRD.md` (status, changelog), `.kiro/specs/poltergeist/tasks.md`, `AGENTS.md` current state, `packages/cli/src/args.ts` help text if it lists personas.
- [ ] Steps: write test → fail → make the fake LLM answer the new personas → pass → docs → `npm run health` → commit `F16: done-when, spec and docs (D-44)`.

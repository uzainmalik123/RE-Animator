# F20 Changeling (keyboard-only) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the sixth persona, the Changeling: a keyboard-only user who reaches controls with Tab, activates them with Enter/Space and types into fields, and fails the app when a visible control can't be reached by keyboard.

**Architecture:** A new DSL step `focus: <target>` (Changeling-only) makes the runner Tab from the current focus until the target holds focus (`runner/focus.ts`). A persona flag `keyboard: true` makes `fill` focus-walk and type instead of using Playwright's `fill`. A per-persona `keys` list limits `press`. A visible, enabled target the walk never reaches becomes a synthetic `reachable` app assertion, the same way the Lich's `usable` does (D-44).

**Tech Stack:** TypeScript, zod 4, playwright-core (Chromium), vitest.

**Spec:** the F20 grill (rulings → D-48), `docs/PRD.md` § F20, `.kiro/specs/poltergeist/requirements.md` Req 4, `design.md` §6.

## Global Constraints

- Prompt text is plain QA wording only: no theme words (D-09). `test/helpers/theme-words.ts` already lists `changeling`.
- The LLM never writes input values (D-04). The Changeling's only generator is `plain`.
- Plan errors are `inconclusive`, never app bugs (D-06). Only a **visible and enabled** target that the walk went round the page without reaching counts as an app failure.
- Contexts only through `newGuardedContext` (D-18, D-22). No new context code is needed.
- Escapes for invisible characters are `\uXXXX` in source.
- `npm run health` green after every task.
- Commit messages `F20: <what>`.

## Review Focus

1. **A page with nothing focusable** (focus stays on `body`). The walk must stop at the cycle (body seen twice), not spin to the cap. Test in Task 3.
2. **The target is already focused** when `focus` starts. That's 0 Tabs, `ok`. Test in Task 3.
3. **A `{text}` target inside a focusable link or button.** It's reached when the focused element contains the target. Test in Task 3.
4. **The target is disabled or hidden.** That's a plain `failed` step (plan error), never `reachable`. Test in Task 3.
5. **A Lich timeout and a Changeling unreachable in one run** must not cross-wire. `reachable` only comes from `unreachable` steps, `usable` only from device timeouts. Test in Task 4 (the wraith clean run plus the changeling haunted run).

---

### Task 1: Persona, step vocabulary and prompt

**Files:**
- Modify: `packages/core/src/personas/steps.ts` (add `'focus'` after `'logout'`)
- Modify: `packages/core/src/personas/registry.ts`
- Modify: `packages/core/src/compiler/dsl.ts` (`StepSchema` gains `z.strictObject({ focus: PlanTargetSchema })`)
- Modify: `packages/core/src/compiler/prompt.ts` (`PROMPT_VERSION = 'f20-1'`; the keys line uses `persona.keys ?? PRESS_KEYS`)
- Test: `packages/core/test/personas/registry.test.ts`, `packages/core/test/compiler/dsl.test.ts`, `packages/core/test/compiler/prompt.test.ts`

**Interfaces:**
- Produces: `PERSONA_IDS = ['wraith','banshee','doppelganger','lich','revenant','changeling']`. `Persona` gains `readonly keys?: readonly PressKey[]` and `readonly keyboard?: true`. `PressKey` is imported from `compiler/dsl.ts` as a type only. If that makes a type cycle, move `PRESS_KEYS` into `personas/steps.ts` and re-export it from `dsl.ts`. `StepType` includes `'focus'`. `Step` includes `{ focus: PlanTarget }`.

- [ ] **Step 1: Update the failing tests**
  - registry: the vocabulary test becomes "the 15-step DSL vocabulary" ending `…, 'login', 'logout', 'focus'`. "lists the six built-in personas in order" ends `'revenant', 'changeling'`. Add `it('changeling', …)` asserting:
    - `allowedSteps` equals `['goto','focus','fill','press','back','reload','wait']`
    - `generators` equals `['plain']`, `actors` is `1`
    - `keys` equals `['Tab','Enter','Space']`, `keyboard` is `true`
    - `device` and `ownSession` are undefined, `sprite` is `'changeling'`
  - Add `it('only the changeling has focus, keys and keyboard (F20)')`. Remove `'changeling'` from the unknown-id `it.each`.
  - dsl: `StepSchema.parse({ focus: { role: 'button', name: 'Save' } })` succeeds, and `{ focus: 'x' }` fails.
  - prompt: for the changeling, `buildUserPrompt` contains `Keys for "press": Tab, Enter, Space`. For the wraith it still lists all nine keys. `PROMPT_VERSION` is `'f20-1'`.

- [ ] **Step 2: Run them and confirm they fail.** Run `npx vitest run test/personas/registry.test.ts test/compiler/dsl.test.ts test/compiler/prompt.test.ts` in `packages/core`. Expect failures on the changeling, focus and version cases.

- [ ] **Step 3: Implement.** Changeling definition, with the copy fixed here:
  - name `'Changeling'`
  - tagline `'Never touches the mouse: Tab, Enter and Space only.'`
  - behaviour: `'A user who only uses the keyboard. Moves between controls with Tab (a focus step tabs to a control), presses Enter or Space to activate the focused control, and types into fields (a fill step tabs to the field and types). Never uses a mouse. Checks that every control the task needs can be reached and used from the keyboard, and that the task completes.'`

  Update the file header comment ("Changeling arrived in F20 (D-48)") and the `Persona` doc comment (`keys` limits `press`; `keyboard` makes `fill` tab to its field and type).

- [ ] **Step 4: Run the Step 2 command and expect PASS.** Then run `npm run health`. Expect failures elsewhere only where tests hard-code five personas, such as `fake-llm.ts` `VALID: Record<PersonaId, …>` (a type error). Fix by adding a `changeling` entry in `VALID`, with `{ goto: '/market' }, { focus: { testId: 'claim-sour-skulls' } }, { press: 'Enter' }` and `assert: [{ api: { method: 'GET', path: '/api/claims', jsonPath: '$.length', equals: 1 } }]`. Re-run until green.

- [ ] **Step 5: Commit** `F20: Changeling persona, focus step and per-persona keys`.

### Task 2: Validator rules and compile Done-when

**Files:**
- Modify: `packages/core/src/compiler/validate.ts`
- Test: `packages/core/test/compiler/validate.test.ts`, `packages/core/test/compiler/done-when.test.ts`

**Interfaces:**
- Consumes: `Persona.keys` and the `focus` step from Task 1.

- [ ] **Step 1: Write the failing tests** (validate.test, `describe('changeling (F20)')`):
  - `{ click: … }` is rejected with ``actors.a[1].click: step "click" is not allowed for this persona (allowed: goto, focus, fill, press, back, reload, wait)``. The same for `dblclick`.
  - `{ focus: <unknown target> }` is rejected with `was not found on the picked routes`.
  - `{ press: 'Escape' }` is rejected with ``actors.a[2].press: key "Escape" is not allowed for this persona (allowed: Tab, Enter, Space)``.
  - A wraith `press: 'Escape'` stays valid.
  - done-when (compile): the F16 loop gains `'changeling'` (≥ 3 compiled criteria). `first.pairs` becomes 30 (5 criteria × 6 personas). Check `scripted` in that file. If it answers per persona from `VALID`, the changeling entry from Task 1 covers it. Otherwise add the changeling's case beside the lich's.

- [ ] **Step 2: Run** `npx vitest run test/compiler` and expect the new cases to FAIL.

- [ ] **Step 3: Implement** in `validatePlan`: a `focus` branch calls `target(path, step.focus)`. A `press` branch errors when `persona.keys` is set and doesn't include the key.

- [ ] **Step 4: Run** `npx vitest run test/compiler` (PASS), then `npm run health`.

- [ ] **Step 5: Commit** `F20: validator rejects mouse steps and other keys for the Changeling`.

### Task 3: Focus walk and keyboard steps in the actor

**Files:**
- Create: `packages/core/src/runner/focus.ts`
- Modify: `packages/core/src/runner/actor.ts`, `packages/core/src/runner/types.ts` (`StepResult.unreachable?: string`)
- Test: `packages/core/test/runner/focus.test.ts` (setup copied from `device.test.ts`: guarded context, `page.setContent`)

**Interfaces:**
- Produces:
  - `MAX_TABS = 100`
  - `focusWalk(page: Page, target: PlanTarget): Promise<FocusWalk>`, where `type FocusWalk = { reached: true; tabs: number; xy?: { x: number; y: number } } | { reached: false; why: 'cycle' | 'cap' }`
  - `probeReachable(page: Page, target: PlanTarget): Promise<'visible' | 'missing'>`. "visible" means some match is visible and enabled.
  - `ActorEnv.keyboard?: true`

Walk algorithm (the tests don't fix this, so here it is):

```
seen = new Set<number>()
for tabs = 0 … MAX_TABS:
  { id, hit } = page.evaluate(deep active element a (follow shadowRoot.activeElement);
      id = stable number for a from a WeakMap kept at window[Symbol.for('poltergeist.focus')];
      hit = matches of the target (passed in as elements via locator.evaluateAll) some
            e === a || e.contains(a) || (a is not body/html && a.contains(e)))
  if hit: return { reached: true, tabs, xy: centre of a's bounding box }
  if seen.has(id) and tabs > 0: return { reached: false, why: 'cycle' }
  seen.add(id); if tabs === MAX_TABS: return { reached: false, why: 'cap' }
  await page.keyboard.press('Tab')
```

Use `locateTarget(page, target).evaluateAll((els, key) => …, symbolKeyString)` so one round trip does both the id and the hit check. Zero matches means `hit` is false.

- [ ] **Step 1: Write the failing tests.** Page:

  ```html
  <a href="#x">Docs <span>guide</span></a>
  <label for="n">Name</label><input id="n">
  <button>Save</button><span role="button">Pay</span>
  <button disabled>Locked</button><button style="display:none">Hidden</button><p id="out"></p>
  <script>
    document.querySelector('button').onclick = () => out.textContent = 'Saved ' + n.value;
  </script>
  ```

  - `focusWalk(page, { role: 'button', name: 'Save' })` gives `{ reached: true, tabs: 3 }` (link, input, button).
  - `{ text: 'guide' }` is reached in 1 Tab.
  - A focused target gives `tabs: 0`. Call `page.focus('#n')` first, then walk to `{ label: 'Name' }`.
  - `{ role: 'button', name: 'Pay' }` gives `{ reached: false, why: 'cycle' }`.
  - `page.setContent('<p>nothing</p>')` with `{ text: 'nothing' }` gives `why: 'cycle'` after at most 3 Tabs (assert the call takes < 1 s).
  - `probeReachable` gives `'visible'` for Pay and `'missing'` for Locked, Hidden and a missing target.
  - Through `runActor` with `keyboard: true`:
    - `[{ focus: Pay }]` ends `failed`, with `steps[0].unreachable` = `'button "Pay" can\'t be reached with Tab'`.
    - `[{ focus: Locked }]` ends `failed`, with `unreachable` undefined and an error matching `/not visible or disabled/`.
    - `[{ fill: { target: { label: 'Name' }, input: { generator: 'plain' } } }, { focus: Save }, { press: 'Enter' }]` ends `done`, and `#out` reads `'Saved ' + generate('plain', 1, 0)`.
    - The focus step's note is `'reached after 3 Tabs'`, and `onStep` gets an xy for it.

- [ ] **Step 2: Run** `npx vitest run test/runner/focus.test.ts` and expect FAIL (no module).

- [ ] **Step 3: Implement `focus.ts`, then wire up `actor.ts`.** `exec` handles `focus` with `reach(target, result)`:
  - It walks. When reached it sets `result.note`, calls `moveCursor`, and returns xy.
  - When not reached and `probeReachable` gives `'visible'`, it sets `result.unreachable = \`${describeTarget(t)} can't be reached with Tab\`` and throws `StepFailure`.
  - When `'visible'` isn't returned, it throws `StepFailure(\`${describeTarget(t)} is not visible or disabled\`)`. If the walk hit the cap, it throws ``gave up after ${MAX_TABS} Tabs`` instead.

  With `env.keyboard`, `fill` calls `reach`, then `page.keyboard.press('ControlOrMeta+A')`, then `page.keyboard.type(value)`. Add `'focus'` to `ACTIONS`. Run reached targets through `env.loaded.redactor.redact` like other errors. `describeTarget` stays in `device.ts` and is imported from there.

- [ ] **Step 4: Run** `npx vitest run test/runner` (PASS), then `npm run health`.

- [ ] **Step 5: Commit** `F20: focus walk and keyboard fill in the runner`.

### Task 4: `reachable` assertion, fixture and Done-when

**Files:**
- Modify: `packages/core/src/runner/run.ts` (pass `keyboard` from the persona; turn an `unreachable` step into an assertion)
- Modify: `packages/core/test/runner/claims-fixture.ts` (`/keys` page)
- Test: `packages/core/test/runner/run.test.ts`, `packages/core/test/runner/done-when.test.ts`

**Interfaces:**
- Consumes: `StepResult.unreachable` and `ActorEnv.keyboard` (Task 3).

- [ ] **Step 1: Write the failing tests.**
  - Fixture `KEYS` page at `/keys`: `<button id="save">Save</button>` sets `#done` to `Saved`, and `<div role="button" id="pay">Pay</div>` (no tabindex) sets `#done` to `Paid` on click.
  - run.test `describe('keyboard persona (F20, D-48)')`:
    - A changeling plan `[goto /keys, focus Pay, press Enter]` with `textVisible: 'Paid'` gives, in every one of 3 reps, `outcome 'completed'` and `assertions` equal to `[{ index: 1, type: 'reachable', ok: false, failure: 'app', detail: 'button "Pay" can\'t be reached with Tab' }]`. `decidePair('20.1','changeling',3,…)` is `{ verdict: 'haunted', failingAssertion: { type: 'reachable' } }`.
    - `[goto /keys, focus Save, press Enter]` with `textVisible: 'Saved'` is `clean`.
    - A wraith clicking Pay with `textVisible: 'Paid'` is clean.
  - done-when (F20, fixture): one changeling run over both plans, with verdicts `haunted` and `clean`.

- [ ] **Step 2: Run** `npx vitest run test/runner/run.test.ts` and expect FAIL. The changeling plan's outcome is `planError`.

- [ ] **Step 3: Implement.** After the `usable` block in `runPair`, add: when `outcome === 'planError'` and some `result.steps` entry has `outcome === 'failed' && unreachable`, set `[outcome, error] = ['completed', undefined]`, add the one `reachable` assertion at index `plan.assert.length`, and emit `assert.result`. Pass `...(persona.keyboard ? { keyboard: true } : {})` into `startActor`.

- [ ] **Step 4: Run** `npx vitest run test/runner` (PASS), then `npm run health`.

- [ ] **Step 5: Commit** `F20: unreachable controls fail as a reachable app assertion`.

### Task 5: Spec, docs and close

**Files:** `.kiro/specs/poltergeist/requirements.md` (Req 4.5), `design.md` (§6 `focus` step, the persona table row), `tasks.md` (tick F20), `docs/PRD.md` (F20 Done, with a note and changelog line), `docs/DECISIONS.md` (D-48), `docs/KNOWN_ISSUES.md` (KI-68 live Candy Swap check; KI-69 no Escape/arrow keys, so radio groups, selects and dialogs can't be operated), `packages/cli/src/args.ts` (`--personas` help lists `changeling`), `integrations/kiro/steering/poltergeist.md` (the disable list), `AGENTS.md` (the state line).

- [ ] **Step 1:** Req 4.5: "THE Persona_Library SHALL include the Changeling, which uses only the keyboard (Tab, Enter and Space, focus and typing) and SHALL report a visible, enabled control it cannot reach with Tab as a failed `reachable` assertion [F20]."
- [ ] **Step 2:** Write D-48 (the rulings from the grill) and KI-68/69. Before numbering, run `git fetch origin` and check the D/KI numbers on `origin/main`.
- [ ] **Step 3:** Run `npm run health` and quote it. Commit `F20: spec, decisions and docs (D-48, KI-68, KI-69)`.

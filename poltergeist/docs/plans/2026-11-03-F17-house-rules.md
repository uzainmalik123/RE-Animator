# F17 Steering-driven House Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `summon()` reads the `## House rules` section of `<configDir>/.kiro/steering/poltergeist.md` and applies it over the config, only ever tightening (Req 4.3). KI-17's redirect-hop half is closed by detecting forbidden redirect hops.

**Architecture:** a new pure module `packages/core/src/steering/` parses the section into `HouseRules` (with warnings) and applies it to a `LoadedConfig`. `summon()` applies disabled personas, extra `forbidden` rules and route notes. Notes reach the compiler prompt and the cache key. The report renderer drops carried pairs of retired personas. The guard reports redirect hops that match a forbidden rule.

**Tech Stack:** TypeScript ESM, vitest, playwright-core.

**Spec:** `.kiro/specs/poltergeist/requirements.md` Req 4.3, `docs/PRD.md` § F17, the grill in this session (recorded as D-45).

## Global Constraints

- Steering only tightens (D-05): it can't touch `target`, `allowedHosts`, `concurrency`, `reps`, `accounts`, or remove config `forbidden` rules.
- Bad lines never throw: an unknown key, unknown persona or malformed rule → a warning naming the line number, and the line is skipped.
- A missing file or section → empty rules, no warning.
- Grammar, inside `## House rules` up to the next `## ` heading. HTML comments (incl. multi-line) are stripped first. Only lines starting `- ` are rules:
  - `- disable: <persona>[, <persona>…]` (ids from `PERSONA_IDS`, case-insensitive)
  - `- forbid: <METHOD|*> <path>` (validated with the config's `ForbiddenSchema` rules: method `^(\*|[A-Za-z]+)$`, path starts with `/`)
  - `- note <path>: <text>` (path starts with `/`; text trimmed, 1–500 chars; a second note for the same path is joined with a space)
- `--personas` ∩ not-disabled; empty → `UsageError('house rules disable every selected persona: …')`.
- Note text enters the prompt verbatim under its page, and into the cache key. With no notes, cache keys must stay byte-identical to today's.
- Never put invisible characters in source as literals (AGENTS.md escapes rule).

## Review Focus

- CRLF line endings in the steering file → parsed the same as LF (test in Task 1).
- `## House rules` heading with trailing spaces or different case (`## House Rules`) → still found (Task 1).
- A rule inside an HTML comment (the template's example block) → ignored, not applied (Task 1).
- `--personas banshee` while steering disables banshee → a clear UsageError, not an empty run (Task 3).
- An old report with Banshee haunted, then Banshee disabled → the criterion's verdict no longer counts the Banshee (Task 4).

---

### Task 1: Parse house rules

**Files:**
- Create: `packages/core/src/steering/rules.ts`, `packages/core/src/steering/index.ts`
- Modify: `packages/core/src/index.ts` (export `./steering/index.js`)
- Test: `packages/core/test/steering/rules.test.ts`

**Interfaces:**
- Produces:
  - `type RouteNote = { path: string; text: string }`
  - `type HouseRules = { path: string | null; disabled: PersonaId[]; forbidden: ForbiddenRule[]; notes: RouteNote[] }`
  - `type HouseRulesResult = { rules: HouseRules; warnings: string[] }`
  - `parseHouseRules(markdown: string, path: string): HouseRulesResult` (pure)
  - `readHouseRules(configDir: string): Promise<HouseRulesResult>` reads `join(configDir, '.kiro', 'steering', 'poltergeist.md')`. ENOENT → `{ rules: { path: null, disabled: [], forbidden: [], notes: [] }, warnings: [] }`. Other read errors → a warning, and empty rules.
  - `STEERING_FILE = '.kiro/steering/poltergeist.md'`

- [ ] **Step 1: Write failing tests**, one `it` each:
  - `disable: Banshee, lich` → `disabled` `['banshee','lich']`, deduped and in input order.
  - `forbid: delete /api/admin*` → `{ method: 'DELETE', path: '/api/admin*' }`. `forbid: GET admin` → warning containing `line` and `forbid`, and nothing added.
  - `note /checkout: Pay stays disabled until the cart has items.` → one note. Two notes on `/checkout` are joined with a space. Text over 500 chars → a warning and skipped.
  - `colour: red` → warning `unknown house rule "colour"`. `disable: wizard` → warning `unknown persona "wizard"`, with the other ids kept.
  - Rules outside the section (in another `##` section) are ignored. A rule inside `<!-- … -->` spanning lines is ignored.
  - `## House Rules  ` with CRLF line endings is found.
  - No section → empty rules, no warnings. `readHouseRules` on a dir with no file → `path: null`, no warnings. With a file → `path` is the absolute file path.
- [ ] **Step 2:** `npx vitest run packages/core/test/steering` → FAIL (module missing).
- [ ] **Step 3: Implement.** Split on `/\r?\n/` after stripping `<!--[\s\S]*?-->`. Warnings are `house rules line N: …` using the 1-based line in the original file (strip comments by replacing them with the same number of newlines, so line numbers hold).
- [ ] **Step 4:** the same command → PASS.
- [ ] **Step 5:** commit `F17: parse house rules from the steering file`.

### Task 2: Route notes reach the prompt and the cache key

**Files:**
- Modify: `packages/core/src/compiler/prompt.ts` (`routeBlock`, `buildUserPrompt`), `packages/core/src/compiler/cache.ts` (`CacheKeyInput`, `cacheKey`), `packages/core/src/compiler/compile.ts` (`CompileOptions.notes`)
- Test: `packages/core/test/compiler/prompt.test.ts`, `cache.test.ts`, `compile.test.ts`

**Interfaces:**
- Consumes: `RouteNote` (Task 1).
- Produces: `CompileOptions.notes?: readonly RouteNote[]`; `buildUserPrompt(criterion, persona, routes, notes?: ReadonlyMap<string, string>)`; `CacheKeyInput.notes?: Record<string, string>`.

- [ ] **Step 1: Failing tests:**
  - prompt: with notes `{'/cart': 'Pay is disabled until…'}`, the `/cart` block contains the line `Project note: Pay is disabled until…` right after its `Page …` line. Other pages have no note line.
  - cache: `cacheKey({...base})` equals `cacheKey({...base, notes: {}})`. Adding `notes: {'/cart': 'x'}` changes the key, and so does changing the text.
  - compile: with the fake LLM, `notes` for a picked route appears in the recorded user prompt. A cached pair recompiles (an LLM call happens) when its note changes.
- [ ] **Step 2:** run those three files → FAIL.
- [ ] **Step 3: Implement.** In `compile()`, build `Map(path → text)` once. For each pair, pass only notes for its picked routes to `cacheKey` (as a sorted-keys object, omitted when empty) and to `buildUserPrompt`. `cacheKey` appends `notes` to the hashed array only when it has keys.
- [ ] **Step 4:** run → PASS.
- [ ] **Step 5:** commit `F17: route notes in the prompt and cache key`.

### Task 3: Apply house rules in `summon()`

**Files:**
- Create: `packages/core/src/steering/apply.ts` (export from `steering/index.ts`)
- Modify: `packages/core/src/summon/summon.ts`
- Test: `packages/core/test/steering/apply.test.ts`, `packages/core/test/summon/summon.test.ts`

**Interfaces:**
- Consumes: `readHouseRules`, `HouseRules` (Task 1); `CompileOptions.notes` (Task 2).
- Produces:
  - `applyHouseRules(loaded: LoadedConfig, rules: HouseRules): LoadedConfig` returns a copy with `config.forbidden = [...config.forbidden, ...new rules not already present (same method upper-cased + path)]`. Nothing else changes.
  - `selectPersonas(ids, disabled: readonly PersonaId[])` in summon: drops disabled ones and throws the Global-Constraints `UsageError` when none remain.
  - `RenderInput.retired?: readonly PersonaId[]` is used by Task 4. summon passes `rules.disabled`.

- [ ] **Step 1: Failing tests:**
  - apply: config forbidden `[{GET,/a}]` + rules `[{get,/a},{POST,/b}]` → `[{GET,/a},{POST,/b}]`. `allowedHosts`, `target` and `concurrency` are unchanged, and the input object isn't mutated.
  - summon (use the existing project fixture + fake LLM): a steering file with `- disable: banshee` → no `plan.compiled` event and no plan file for `banshee`, and `onWarning` got `house rules: banshee disabled`. **(PRD Done-when.)**
  - summon: `personas: ['banshee']` + steering disabling banshee → rejects with `UsageError` whose message contains `house rules`.
  - summon: a steering `forbid` rule appears in `run.json` `houseRules.forbidden`, and the guard blocks it (assert via the `LoadedConfig` passed to the runner: check `run.json.houseRules` and that a plan step hitting it is `blocked-by-rule` if the fixture supports it; otherwise only `run.json`).
  - summon: parse warnings reach `onWarning`.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement.** After `loadConfig`: `const house = await readHouseRules(loaded.configDir)`. Forward its warnings. `loaded = applyHouseRules(loaded, house.rules)`. Warn `house rules: <ids> disabled` when non-empty. Pass `notes` to `compile`. Add `houseRules: house.rules` to `runJson` only when `house.rules.path !== null`.
- [ ] **Step 4:** run → PASS.
- [ ] **Step 5:** commit `F17: summon applies house rules`.

### Task 4: Retired personas aren't carried in the report

**Files:**
- Modify: `packages/core/src/report/render.ts`
- Test: `packages/core/test/report/render.test.ts`

**Interfaces:**
- Consumes: `RenderInput.retired` (set by Task 3).

- [ ] **Step 1: Failing tests** (use `test/report/builders.ts`):
  - A previous report has 1.1 with banshee `haunted` + wraith `clean`. This run runs wraith only (`clean`) with `retired: ['banshee']` → the row has one pair (wraith), verdict `clean`.
  - The same previous report, criterion 1.1 not run at all (`--only` another), `retired: ['banshee']` → the carried row keeps only wraith, and its verdict is `rollUp(['clean'])`. If no pairs remain → `notRun` with no `carriedFrom`.
  - Without `retired`, today's behaviour is unchanged (the existing tests still pass).
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement.** Filter `before.pairs` by `!retired.has(p.persona)` in both branches. In the not-run branch, recompute the verdict with `rollUp` only when something was filtered out.
- [ ] **Step 4:** run → PASS.
- [ ] **Step 5:** commit `F17: drop retired personas from carried report rows`.

### Task 5: Guard reports forbidden redirect hops (KI-17)

**Files:**
- Modify: `packages/core/src/safety/guard.ts` (`installNetworkGuard`)
- Modify: `packages/core/test/safety/fixture-server.ts` (only if `/redirect` can't already send a 307 to a same-origin path)
- Test: `packages/core/test/safety/guard.test.ts`

**Interfaces:** none new. A hop is reported as `{ reason: 'forbidden', rule, host, url: hopUrl, method, resourceType }`.

- [ ] **Step 1: Failing test:** a guarded context with `forbidden: [{ method: '*', path: '/secret*' }]`. Fetch `/redirect?to=<origin>/secret` → `onBlocked` is called exactly once with `reason: 'forbidden'` and the `/secret` URL. A redirect to an allowed path → no report.
- [ ] **Step 2:** `npx vitest run packages/core/test/safety/guard.test.ts` → FAIL.
- [ ] **Step 3: Implement.** `context.on('request', r => { if (!r.redirectedFrom()) return; … })`. Use the same `verdict()`, but only report `reason === 'forbidden'` (host/scheme hops are already covered by the dead proxy and `requestfailed`). Add a doc comment that the hop is reported, not prevented (KI-62).
- [ ] **Step 4:** run → PASS. Also `npm run test:guard:1cpu`.
- [ ] **Step 5:** commit `F17: report forbidden redirect hops (KI-17)`.

### Task 6: Template, spec and docs

**Files:** `integrations/kiro/steering/poltergeist.md`, `.kiro/specs/poltergeist/requirements.md` (4.3), `design.md` (steering section), `tasks.md`, `docs/PRD.md` (status, changelog), `docs/DECISIONS.md` (D-45), `docs/KNOWN_ISSUES.md` (KI-17 resolved, KI-62 new, KI-63 Kiro check), `AGENTS.md` (current state), `docs/STACK.md` only if it lists modules.

- [ ] **Step 1:** In the template, replace the House rules comment with a comment holding the three syntax examples. They stay inside the comment, so a fresh `init` applies no rules. Check `packages/cli` init tests still pass, since they may snapshot the template.
- [ ] **Step 2:** Req 4.3: "WHERE the target project has a Poltergeist steering file, THE Persona_Library SHALL apply its persona disable flags, extra forbidden rules and route notes, and steering SHALL only ever tighten rules [F17]."
- [ ] **Step 3:** D-45 (the grill's rulings), KI-17 → Resolved 2026-11-03 (hops reported), KI-62 (a forbidden hop is reported, not prevented: Minor), KI-63 (the Done-when on Candy Swap with a live LLM: deferred to the Kiro batch).
- [ ] **Step 4:** `npm run health` → exit 0.
- [ ] **Step 5:** commit `F17: spec, decisions and docs (D-45, KI-62, KI-63)`.

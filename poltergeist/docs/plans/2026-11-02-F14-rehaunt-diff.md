# F14 Re-haunt & Verdict Diff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A subset run (`--only` / `rehaunt`) keeps the full report picture, and every run reports how each re-run criterion's verdict changed since the previous run (`3.2 [!!] → [ok]`).

**Architecture:** The baseline is the spec's previous `haunting-report.json` (D-42). `renderReport` takes it as `previous` and merges: anything not run this time (a criterion, or a persona inside a re-run criterion) is carried over with `carriedFrom`, and re-run criteria roll up over the merged pairs. A pure `diffVerdicts(previous, current)` compares the rows that ran. `summon` reads the old report before writing the new one and returns `changes`. The CLI prints a change block, and MCP adds `changes` to run summaries.

**Tech Stack:** TypeScript (Node ≥ 22, ESM), zod 4, vitest, playwright-core.

**Spec:** `.kiro/specs/poltergeist/requirements.md` Req 9.3, `design.md` §MCP (`rehaunt` → `changes: [{id, from, to}]`), `docs/PRD.md` § F14, grill decisions → D-42.

## Global Constraints

- Never write anything in the spec folder except `haunting-report.md` / `.json` (D-14).
- `haunting-report.json` stays `version: 1`. New fields are optional only.
- MCP tool text ≤ 6 000 chars (`MAX_TEXT`), and id lists are capped at `MAX_IDS` (20).
- The plan cache is unchanged: `cacheKey` already includes `criterionHash` ("cached unless the criterion text changed").
- Exit codes are unchanged (D-36).
- `npm run health` is green after every task.

## Review Focus

1. **The target changed between runs:** carrying old verdicts would claim results about a different app. Rows aren't carried (`notRun`), and there is no diff. Test in Task 1.
2. **A criterion's text was edited, or its id vanished:** the old verdict is about a different promise. It isn't carried and isn't diffed. Test in Task 1.
3. **A missing, corrupt or wrong-version previous report:** treated as having no baseline, never an error. Test in Task 1 (`readReportJson`).
4. **A re-run with a persona subset:** the other personas' pairs must survive, and the criterion verdict must roll up over all of them (rehaunting with only doppelganger can't hide a haunted banshee). Test in Task 1.
5. **Repeated subset runs:** a pair carried twice keeps its *original* `carriedFrom`, not the intermediate run's id. Test in Task 1.

---

### Task 1: Report merge, `readReportJson` and `diffVerdicts` (core)

**Files:**
- Modify: `packages/core/src/report/schema.ts`: optional `carriedFrom: z.string()` on `PairSchema` and on each criteria row.
- Create: `packages/core/src/report/merge.ts`
- Modify: `packages/core/src/report/render.ts`: `ReportInput.previous?: ReportJson`, and merge it into rows.
- Modify: `packages/core/src/report/index.ts`: exports.
- Test: `packages/core/test/report/merge.test.ts` (new), `packages/core/test/report/render.test.ts`

**Interfaces:**
- Produces:
  - `type ReportVerdict = CriterionVerdict | 'notRun'`
  - `type VerdictChange = { id: string; from: ReportVerdict; to: ReportVerdict; personas: { persona: PersonaId; from: PairVerdict; to: PairVerdict }[] }`
  - `readReportJson(specDir: string): Promise<ReportJson | undefined>`: `undefined` when the file is missing, unparsable or fails `ReportJsonSchema`.
  - `usableRow(previous: ReportJson | undefined, target: string, c: Pick<Criterion, 'id' | 'text'>): ReportJson['criteria'][number] | undefined`: the row only when `previous.target === target`, and a row with the same id has the same `text`.
  - `diffVerdicts(previous: ReportJson | undefined, current: ReportJson): VerdictChange[]`: over the current rows **without** `carriedFrom` (they ran this time) that have a usable previous row. An entry is returned when the criterion verdict changed or any persona that ran this time (a pair without `carriedFrom`) has a different verdict from the previous pair for that persona. Personas absent before are skipped. In spec order.
  - `renderReport({ ..., previous })`: the merge rules below.

**Merge rules in `renderReport`** (rows are built for every `input.criteria`):
- The criterion ran this time (it's in `input.verdicts.criteria`): the pairs are this run's pairs, plus the usable previous row's pairs whose persona isn't among this run's pairs for it. Those are carried with `carriedFrom: p.carriedFrom ?? previous.runId`. Verdict = `rollUp(all pair verdicts)` (from `verdicts/compute.ts`).
- Not run, with a usable previous row: the row is copied whole with `carriedFrom: row.carriedFrom ?? previous.runId`. Its pairs keep their own `carriedFrom` or get `previous.runId`.
- Otherwise: `notRun` with no pairs (as today).
- Markdown: a carried board line ends with ` _(earlier run <codeSpan id>)_`. A carried pair's `####` heading in a haunted section gets the same suffix. When any row or pair is carried, add a head line under the counts: `_Merged: N criteria kept from earlier runs; re-run them to refresh._` (N = carried rows).

- [ ] **Step 1: Write the failing tests** in `merge.test.ts`, building `previous` with `renderReport(input()).json` (reuse the `render.test.ts` builders; move `input`, `reps`, `compiled`, `simple`, `RACE`, `at` and `RUN` into `packages/core/test/report/builders.ts` and import them in both files):
  - `subset run carries every criterion it did not run`: the second render has only `3.2` in verdicts (doppelganger clean) with `previous` = first json and runId `r2`. `2.1` keeps `flaky`, with `carriedFrom: 'r1'` and its pairs carried; `3.2` → `clean` and has no `carriedFrom`; `counts.flaky === 1`; the markdown board line for 2.1 contains `_(earlier run \`r1\`)_`, and the markdown contains `_Merged: `.
  - `re-run criterion rolls up over carried personas`: previous 3.2 has doppelganger haunted and banshee haunted. The re-run has only doppelganger clean, so 3.2 stays `haunted`, the banshee pair has `carriedFrom: 'r1'` and the doppelganger pair has none.
  - `carriedFrom survives a second subset run`: r1 → r2 (subset 3.2) → r3 (subset 3.2): `2.1.carriedFrom === 'r1'`.
  - `no carry when the target changed`: previous.target differs, so 2.1 → `notRun` with no pairs, and `diffVerdicts` returns `[]`.
  - `no carry or diff when a criterion's text changed`.
  - `diffVerdicts reports criterion and persona changes`: 3.2 haunted→clean gives `[{ id: '3.2', from: 'haunted', to: 'clean', personas: [{ persona: 'doppelganger', from: 'haunted', to: 'clean' }] }]`. An unchanged re-run gives `[]`. With no previous it's `[]`.
  - `readReportJson`: a missing file, `{not json`, or `{"version":2}` each give `undefined`, and a written `renderReport(...).json` round-trips.
  - Each merged json passes `ReportJsonSchema.parse`.
- [ ] **Step 2:** `npx vitest run packages/core/test/report`. Expect FAIL (`merge.js` missing).
- [ ] **Step 3:** Implement the schema fields, `merge.ts` and the render merge. Export `readReportJson`, `diffVerdicts`, `usableRow` and the types `VerdictChange` and `ReportVerdict` from `report/index.ts`. Check that `packages/core/src/index.ts` re-exports `report/index.ts` (it does via `export *`; if not, add it).
- [ ] **Step 4:** `npx vitest run packages/core/test/report`. Expect PASS, with existing render tests unchanged.
- [ ] **Step 5:** `npm run health`, then commit `F14: report merges earlier runs and diffs verdicts`.

### Task 2: `summon` merges and returns `changes`

**Files:**
- Modify: `packages/core/src/summon/summon.ts`, `packages/core/src/summon/types.ts`
- Modify: `packages/core/test/runner/claims-fixture.ts`: `fix(): void` on `ClaimsFixture` (tests only). After it, `POST /api/claims` checks and inserts with no `await` in between, so the race is gone. `/__reset` doesn't undo it.
- Test: `packages/core/test/summon/summon.test.ts`

**Interfaces:**
- Consumes: Task 1's `readReportJson`, `diffVerdicts`, `renderReport({ previous })`.
- Produces: `SummonResult.changes: VerdictChange[]` and `SummonResult.previousRunId?: string` (the previous report's `runId`, only when one was read). `renderReport` now gets **all** spec criteria (`all`), not just the selected ones. `SummonResult.criteria` stays the selected ones.

- [ ] **Step 1: Write the failing test** `a subset run keeps the full report and diffs against the previous one`. The claims project runs with personas wraith and doppelganger (3.2 haunted, 3.1 clean), then `project.fixture.fix()`, then `summon({ only: ['3.2'], personas: ['doppelganger'], reps: 1 })`. Expect `r2.changes` toEqual `[{ id: '3.2', from: 'haunted', to: 'clean', personas: [{ persona: 'doppelganger', from: 'haunted', to: 'clean' }] }]` and `r2.previousRunId === r1.runId`. The JSON report rows are `['3.1', '3.2']`, 3.1 is `clean` with `carriedFrom: r1.runId`, and 3.2 is `clean`. Use a fresh `makeClaimsProject()` for this test because `fix()` is permanent.
- [ ] **Step 2:** `npx vitest run packages/core/test/summon`. Expect FAIL.
- [ ] **Step 3:** In `summon`, after `computeVerdicts`, run `const previous = await readReportJson(specDir)`, then render with `criteria: all, previous`, then `changes = diffVerdicts(previous, rendered.json)`. Return `changes` and `previousRunId`.
- [ ] **Step 4:** `npx vitest run packages/core/test/summon`. Expect PASS.
- [ ] **Step 5:** `npm run health`, then commit `F14: summon merges subset runs into the report and returns changes`.

### Task 3: CLI change block

**Files:**
- Modify: `packages/cli/src/term/board.ts`: `renderBoard` prints a block when `r.changes.length > 0`, between the rows and the counts.
- Test: `packages/cli/test/term.test.ts`, `packages/cli/test/done-when.test.ts`

Block format (no colour):
```
changes since <previousRunId>:
  3.2 [!!] → [ok]
```
Each glyph is painted with `TONE[verdict]`. Ids pass through `termSafe`. Persona changes are not printed (they're in the JSON).

- [ ] **Step 1: Write the failing tests:**
  - `term.test.ts`: `renderBoard` with `changes: [{ id: '3.2', from: 'haunted', to: 'clean', personas: [] }]` and `previousRunId: 'r1'` contains `changes since r1:\n  3.2 [!!] → [ok]`. With `changes: []` it contains no `changes since`.
  - `done-when.test.ts`, a new `describe('F14 Done-when (fixture)')` with its own `makeClaimsProject()`: run `summon` with personas wraith,doppelganger (exit 1), then `fixture.fix()`, then `summon --only 3.2 --personas doppelganger --reps 1`. Expect exit 0, stdout contains `3.2 [!!] → [ok]`, and the whole second call takes `< 30_000` ms.
- [ ] **Step 2:** `npx vitest run packages/cli/test/term.test.ts packages/cli/test/done-when.test.ts`. Expect FAIL.
- [ ] **Step 3:** Implement it. Update test helpers that build a `SummonResult` to include `changes: []`.
- [ ] **Step 4:** Run the tests again. Expect PASS.
- [ ] **Step 5:** `npm run health`, then commit `F14: CLI prints verdict changes since the previous run`.

### Task 4: MCP `changes` and shared report reader

**Files:**
- Modify: `packages/mcp/src/format.ts`: `RunSummary.changes?: { id: string; from: ReportVerdict; to: ReportVerdict }[]` (only criteria whose verdict changed, the first `MAX_IDS`), and `previousRunId` beside it. `summarize` sets both only when that list is non-empty. When a change ends in `clean` and nothing is haunted, the hint reads `Fixed: <ids>. Call summon_ghosts to check the whole spec.`
- Modify: `packages/mcp/src/report.ts`: delete the private `readJson` and use core's `readReportJson`.
- Modify: `packages/mcp/src/server.ts`: update the `rehaunt` description to say it also returns `changes` (verdict before → after).
- Test: `packages/mcp/test/format.test.ts`, `packages/mcp/test/done-when.test.ts`

- [ ] **Step 1: Write the failing tests:**
  - `format.test.ts`: `summarize` of a result with a haunted→clean change gives `changes: [{ id: '3.2', from: 'haunted', to: 'clean' }]` and a hint starting `Fixed: 3.2`. A change list made only of persona changes (same criterion verdict) gives no `changes` key.
  - `done-when.test.ts`, a new `describe('F14 Done-when (fixture)')` with its own project: `summon_ghosts` (personas wraith, doppelganger) → haunted `['3.2']` → `project.fixture.fix()` → `rehaunt { ids: ['3.2'], personas: ['doppelganger'], reps: 1 }`. Expect `changes` toEqual `[{ id: '3.2', from: 'haunted', to: 'clean' }]`, `haunted: []` and elapsed `< 30_000`. Then `get_haunting_report` (board) still lists `3.1` with `[ok]`.
- [ ] **Step 2:** `npx vitest run packages/mcp`. Expect FAIL.
- [ ] **Step 3:** Implement it.
- [ ] **Step 4:** `npx vitest run packages/mcp`. Expect PASS.
- [ ] **Step 5:** `npm run health`, then commit `F14: rehaunt returns verdict changes`.

### Task 5: Docs and close

**Files:** `docs/DECISIONS.md` (D-42), `docs/KNOWN_ISSUES.md` (KI-47 Resolved; KI-48 note: "ids absent after a subset run" is fixed by the merge; new KI-53: the real <30 s `rehaunt` exorcism on Candy Swap in Kiro is pending KI-44), `docs/PRD.md` (F14 status `Done (fixture, D-42; Candy Swap check KI-53)` + changelog), `.kiro/specs/poltergeist/design.md` (the run-folder line: F14 diffs the previous `haunting-report.json`; `rehaunt` row `changes`), `.kiro/specs/poltergeist/tasks.md`, and `AGENTS.md` (current state).

- [ ] **Step 1:** Run `git fetch origin` and check that D-42 and KI-53 are still free on `origin/main`. Renumber if not.
- [ ] **Step 2:** Write the entries.
- [ ] **Step 3:** `npm run health`, then commit `F14: docs (D-42, KI-53)`.

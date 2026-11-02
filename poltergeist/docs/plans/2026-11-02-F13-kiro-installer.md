# F13 Kiro Installer (`init`) + Agent Hook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `poltergeist init` (and an exported `init()`) wires a project into Kiro: it scaffolds `poltergeist.config.json` and writes the MCP entry, a steering file and an agent hook into the project's `.kiro/`, idempotently, never overwriting without `--force`.

**Architecture:** The templates live in `integrations/kiro/` (D-01), and `init` reads and fills them. `packages/cli/src/init/` holds two pieces. `plan.ts` is pure: options → the files to write. `apply.ts` does the fs work: compare, skip or write, with path and symlink checks. The CLI `main` dispatches `init` and maps the outcomes to exit codes. Reanimator can import `init` from `@poltergeist/cli` and wire up a revived repo for its R5 heal loop.

**Tech Stack:** TypeScript, Node ≥ 22 `node:fs/promises`, vitest, `@poltergeist/core` (`parseConfig`, `ConfigError`), `@modelcontextprotocol/sdk` client (test only, already a workspace dep through `@poltergeist/mcp`).

**Spec:** `.kiro/specs/poltergeist/requirements.md` Req 10.3, `design.md` §11, `docs/PRD.md` F13, `docs/kiro-notes.md` (hooks), D-38, D-41 (this cycle's grill).

## Global Constraints

- Req 10.3: THE Installer SHALL write the MCP entry, a steering file and an agent hook into a target's `.kiro/`, and SHALL NOT overwrite existing files without `--force`.
- D-38: the MCP entry is `"command": "node"`, with `args: [<absolute poltergeist-mcp.js>, "--root", <absolute project dir>]`, never `npx` and never `--root .`. `autoApprove` stays exactly the three read-only tools.
- Hook format (kiro.dev/docs/hooks, fetched 2026-11-02): `.kiro/hooks/*.json` = `{"version":"v1","hooks":[{"name","description","trigger","action":{"type":"agent","prompt"}}]}`. Trigger `PostTaskExecution`.
- D-09: plain QA wording in the steering and hook text (no theme words: no "ghost", "haunt" or "summon" except the literal tool names `summon_ghosts`, `rehaunt` and `get_haunting_report` and the file name `haunting-report.md`).
- D-14: never touch `requirements.md`, `design.md` or `tasks.md`. D-05: the scaffolded `target` must pass `parseConfig` (loopback unless allowlisted).
- `npm run health` green. Pinned versions, no new dependencies.

## Review Focus

- **An existing `.kiro/settings/mcp.json` holding other servers:** they must survive byte-for-byte as JSON values, also under `--force` (Task 2 test `keeps other servers`).
- **A malformed `mcp.json`:** refuse with exit 2 and leave the file untouched, even with `--force` (Task 2 test `refuses invalid mcp.json`).
- **A `.kiro` or target file that is a symlink pointing outside the project:** refuse with exit 2 and write nothing outside (Task 2 test `refuses symlinks`).
- **Paths with spaces** in the project dir: they appear verbatim in `args`, since this is JSON, not a shell (Task 1 test `absolute paths with spaces`).
- **A non-loopback `--target`** such as `https://example.com`: `ConfigError` → exit 2, and nothing is written (Task 2 test `rejects non-loopback target before writing`).

---

### Task 1: Templates and the pure planner

**Files:**
- Create: `integrations/kiro/hooks/poltergeist-summon.json`, `integrations/kiro/steering/poltergeist.md`
- Modify: `integrations/kiro/README.md` (describe all three templates and `poltergeist init`)
- Create: `packages/cli/src/init/plan.ts`
- Test: `packages/cli/test/init-plan.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type InitOptions = { dir: string; target?: string; spec?: string; hook?: boolean; force?: boolean;
    /** Defaults to this checkout's packages/mcp/bin/poltergeist-mcp.js. */ mcpBin?: string;
    /** Defaults to this checkout's integrations/kiro. */ templatesDir?: string };
  export type PlannedFile =
    | { path: string; kind: 'text'; content: string }               // path relative to dir, posix
    | { path: '.kiro/settings/mcp.json'; kind: 'mcp-entry'; entry: McpEntry };
  export type McpEntry = { command: 'node'; args: string[]; env: Record<string, string>; autoApprove: string[] };
  export const DEFAULT_TARGET = 'http://localhost:3000';
  export function planInit(opts: InitOptions): Promise<PlannedFile[]>;
  ```
- Order of the result: `poltergeist.config.json`, `.kiro/settings/mcp.json`, `.kiro/steering/poltergeist.md`, then `.kiro/hooks/poltergeist-summon.json` (omitted when `hook === false`).

- [ ] **Step 1: Write the templates.**
  - **Hook:** one hook named `poltergeist-check-spec`, with a `description`, `"trigger": "PostTaskExecution"` and `"action": {"type":"agent","prompt": …}`. The prompt contains the placeholder `{{SPEC}}`. It asks the agent to call `summon_ghosts` for `{{SPEC}}`, read the board with `get_haunting_report`, fix any failing criteria, and confirm each fix with `rehaunt`. It does nothing if the app isn't running on the configured target.
  - **Steering:** front matter `---\ninclusion: always\n---`. It explains the five tools, `haunting-report.md`, that tests run only against the local app in `poltergeist.config.json`, and not to edit `requirements.md`. It ends with an empty `## House rules` section and an HTML comment saying F17 reads it.
- [ ] **Step 2: Write the failing tests** in `init-plan.test.ts`:
  - `planInit({dir:'/p a/app'})` returns the 4 paths in order.
  - The `mcp-entry` args equal `[<abs mcp bin ending packages/mcp/bin/poltergeist-mcp.js>, '--root', '/p a/app']`, and `env` is `{ANTHROPIC_API_KEY:'${ANTHROPIC_API_KEY}'}`. `autoApprove` sorted equals `['get_haunting_report','get_run_status','list_criteria']` (taken from `integrations/kiro/mcp.json`, not hard-coded in `plan.ts`).
  - The config content parses through `parseConfig(JSON.parse(c), {configPath:'/p a/app/poltergeist.config.json'})`, with `target` = `http://localhost:3000`, `routes` `[{path:'/',auth:false}]`, `concurrency` 12 and `reps` 3. It ends in `\n`.
  - With `target: 'http://127.0.0.1:5173'` the config uses it. With `target: 'https://example.com'` `planInit` rejects with `ConfigError`.
  - The hook JSON has `version` `'v1'`, one hook with trigger `PostTaskExecution`, and action type `'agent'`. The prompt has no `{{`. Without `spec` it says "the spec whose tasks just ran". With `spec: '.kiro/specs/shop'` the prompt contains `` `.kiro/specs/shop` ``.
  - `hook: false` gives 3 files.
  - D-09: the steering and hook text, with the tool names and `haunting-report.md` removed, match none of `/ghost|haunt|summon|spirit|possess/i`.
  - `dir` relative → resolved to absolute against `process.cwd()`.
- [ ] **Step 3: Run** `npx vitest run packages/cli/test/init-plan.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 4: Implement `planInit`.**
  - Resolve the defaults from `import.meta.url`: `../../../mcp/bin/poltergeist-mcp.js` and `../../../../integrations/kiro/`.
  - Build `args` from `integrations/kiro/mcp.json` by replacing `args[0]` and the value after `--root`.
  - Validate the config with `parseConfig` before returning (env `{}`).
- [ ] **Step 5: Run** the test again. Expected: PASS. Then run `npx vitest run packages/mcp/test/template.test.ts`. Expected: PASS (the template is unchanged).
- [ ] **Step 6: Commit** `F13: init templates and planner`.

### Task 2: Apply: idempotent, safe writes

**Files:**
- Create: `packages/cli/src/init/apply.ts`, `packages/cli/src/init/index.ts`
- Modify: `packages/cli/src/index.ts` (export `init`, `planInit`, `DEFAULT_TARGET`, and the types `InitOptions`, `InitResult` and `InitOutcome`)
- Test: `packages/cli/test/init-apply.test.ts`

**Interfaces:**
- Consumes: `planInit`, `InitOptions` and `PlannedFile` from Task 1.
- Produces:
  ```ts
  export type InitOutcome = 'created' | 'unchanged' | 'skipped' | 'overwritten';
  export type InitResult = { dir: string; files: { path: string; outcome: InitOutcome }[] };
  export class InitError extends Error { name = 'InitError' }
  export function init(opts: InitOptions): Promise<InitResult>;   // index.ts: plan, then apply
  ```

- [ ] **Step 1: Write the failing tests**, each on a fresh `mkdtemp` dir:
  - First run → all 4 `created`. Second run → all `unchanged`, and the files are byte-identical.
  - Editing the steering file → `skipped`, and the edit is kept. With `force` → `overwritten`, and the content equals the template.
  - **`keeps other servers`:** a pre-existing `mcp.json` holding `{"mcpServers":{"other":{"command":"x"}},"extra":1}` → `created` (the poltergeist entry was added). Then `other` and `extra` are deep-equal to before. A changed poltergeist entry → `skipped`, and with `force` → `overwritten` while `other` survives. An identical entry → `unchanged`, compared by deep equality, not bytes.
  - **`refuses invalid mcp.json`:** `{oops` → rejects `InitError` with and without `force`, the file is untouched, and no other file was created (validate everything before any write).
  - **`refuses symlinks`:** `.kiro` symlinked to an outside temp dir → `InitError` naming the path, and the outside dir stays empty. The same applies when the steering file itself is a symlink.
  - **`rejects non-loopback target before writing`:** `target: 'https://example.com'` → `ConfigError`, and `dir` stays empty.
  - **D-14:** pre-create `.kiro/specs/x/requirements.md`; it's unchanged after `init` with `force`.
  - `dir` that doesn't exist → `InitError`.
- [ ] **Step 2: Run** `npx vitest run packages/cli/test/init-apply.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `apply.ts` in two phases.**
  - **Phase 1, decide:** for each file, `lstat` every path segment from `dir` down. If any existing one is a symlink → `InitError`. Read the existing content and parse `mcp.json`; a bad parse, or a top-level or `mcpServers` value that isn't an object → `InitError`. Compute the outcome.
  - **Phase 2, write:** write each `created`/`overwritten` file (`mkdir -p` the parents). `mcp.json` is written as `JSON.stringify(merged, null, 2) + '\n'`.
  - `dir` must exist and be a directory.
- [ ] **Step 4: Run** the test again. Expected: PASS.
- [ ] **Step 5: Commit** `F13: init applies files idempotently, never through symlinks`.

### Task 3: CLI `init` command and Done-when

**Files:**
- Modify: `packages/cli/src/args.ts` (an `init` variant and help text), `packages/cli/src/main.ts` (dispatch)
- Test: `packages/cli/test/args.test.ts` (extend), `packages/cli/test/init-done-when.test.ts`

**Interfaces:**
- Consumes: `init`, `InitError` and `InitResult` from Task 2.
- Produces: `CliArgs` gains `{ command: 'init'; dir?: string; target?: string; spec?: string; hook: boolean; force: boolean }`. Flags: `--dir`, `--target`, `--spec`, `--no-hook`, `--force`.

- [ ] **Step 1: Write the failing tests.**
  - **args:**
    - `['init']` → `{command:'init', hook:true, force:false}`.
    - `['init','--dir','a','--target','http://localhost:5173','--spec','s','--no-hook','--force']` → all fields set.
    - `['init','--reps','2']` → `UsageError` (summon-only flag).
    - `['summon','--spec','x','--force']` → `UsageError`.
    - `HELP_TEXT` contains `poltergeist init`.
  - **Done-when** (`init-done-when.test.ts`, spawning the real bin `packages/cli/bin/poltergeist.js` with `NO_COLOR=1`):
    1. `init --dir <tmp>` exits 0. Stdout lists the 4 paths with `created`.
    2. Rerun → exit 0, all `unchanged`.
    3. Edit the steering file and rerun → exit 1, stdout says `skipped` and mentions `--force`. `--force` → exit 0, `overwritten`.
    4. `--target https://example.com` on a fresh dir → exit 2, stderr contains `not allowlisted`.
    5. Read the written `.kiro/settings/mcp.json`. Start `StdioClientTransport({command: entry.command, args: entry.args})` (no cwd given). `listTools` gives the 5 tools. This proves there's no manual MCP setup.
    6. The written hook passes the same shape checks as Task 1.
- [ ] **Step 2: Run** `npx vitest run packages/cli/test/args.test.ts packages/cli/test/init-done-when.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **`parseCliArgs`:** add the options. `--no-hook` is the boolean option `no-hook`. Reject flags that belong to the other command with `UsageError('<flag> is not a <command> option')`.
  - **`main`:** on `init`, call `init({dir: resolve(cwd, args.dir ?? '.'), …})` and print one line per file, `<outcome padded to 11> <path>`. If anything was skipped, add the line `some files differ and were kept; rerun with --force to replace them`. Exit 1 if any were skipped, otherwise 0. `ConfigError`/`InitError` → `fail(message)`, exit 2. Print a `next:` hint: start the app on the target, open the project in Kiro and approve `ANTHROPIC_API_KEY`.
- [ ] **Step 4: Run** the tests. Expected: PASS. Then run `npm run health`. Expected: exit 0.
- [ ] **Step 5: Commit** `F13: poltergeist init command and Done-when`.

### Task 4: Docs close-out

**Files:** `docs/PRD.md` (F13 status and changelog), `.kiro/specs/poltergeist/tasks.md`, `.kiro/specs/poltergeist/design.md` §11 note, `docs/kiro-notes.md` (hooks: docs-confirmed format), `docs/DECISIONS.md` (D-41), `docs/KNOWN_ISSUES.md` (KI-06 update, new KI for the real Kiro check plus the review minors), `AGENTS.md` current state, `README.md` if it lists commands.

- [ ] **Step 1:** Write D-41 (the grill rulings above), update the KI-06 hooks line, and add KI-51: *F13 Done-when not yet run in Kiro (does `PostTaskExecution` fire the agent prompt, and does Kiro load the written `mcp.json` with no manual step)*.
- [ ] **Step 2:** Set the PRD F13 status to `Done (fixture, D-41; Kiro check KI-51)`, tick `tasks.md`, and update the summary tables.
- [ ] **Step 3:** Run `npm run health`. Expected: exit 0. Commit `F13: docs (D-41, KI-51)`.

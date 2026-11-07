# Requirements: R8, the autopsy (why it died)

## Introduction

When the necromancer raises a dead repo, the panel shows that it flatlined and that it rose. R8 adds the missing middle: **what killed it, and what was changed to bring it back.** The necromancer reads the body.

The grill (2026-11-07, built in Kiro per D-R18, recommended answer at every question) settled:

- **The cause is computed, never written by hand or guessed by a model.** It is the real first failing vital of the untouched corpse plus a real diff of the corpse against the body after the remedy. A cause that is not in the diff is not shown (D-R11).
- **It rides the ritual stream** as one new event, `autopsy`, emitted right after `remedy`. The recorder (R11) and the replay therefore carry it with no extra plumbing, and old recordings without it still play.
- **A fixed, deterministic table of known deaths** (a pinned engine, a removed Node API, and R9's four rites) names the causes. A change outside the table is still shown, plainly, as "changed".
- **Each cause is tied to the flatline**: it says whether the corpse's real failing output named it (`seen`).
- **It never blocks the raise.** If the autopsy cannot be computed, the ritual goes on without it.
- **The panel shows real text**: the cause, a ruled diff box, the file. A small dot-matrix slab with a scanning light is only the costume. No red: red is Death's and the wounds' (THEME §4).
- **A "Copy autopsy" button** produces Markdown for a human's PR description (D-R10).

## Requirements

### 1. The autopsy is computed from the real run

**User Story:** As a developer, I want to know what killed the repo and what was changed, so that I trust the revive.

1. WHEN the remedy has been applied THE ritual SHALL compare the untouched corpse with the remedied body and emit one `autopsy` event before the revived vitals run.
2. THE autopsy SHALL record `diedAt`, the first corpse vital that really failed, or `null` if none did, and `symptom`, the first line of that vital's real output.
3. THE autopsy SHALL list one cause per changed file (and per changed top-level `package.json` field), each with a `kind`, a plain-text `title` and `why`, the `file` (relative to the repo, never an absolute path), the removed and added evidence lines, and `seen`.
4. THE autopsy SHALL ignore `node_modules`, `.git`, binary files and files over 64 KB, and SHALL cap evidence at 40 lines per cause, each line at 200 characters, and causes at 12, and SHALL say when it truncated.
5. IF computing the autopsy throws THEN THE ritual SHALL continue without emitting it.
6. IF nothing changed THEN THE autopsy SHALL carry no causes, and the panel SHALL say so ("the body keeps its secret").

### 2. Known deaths are named

**User Story:** As a developer, I want a cause I can read, not a raw diff.

1. THE classifier SHALL name these kinds: `engine-pin` (an `engines` change or `engine-strict` dropped), `node-sass`, `openssl`, `lockfile`, `removed-api` (a removed line using a Node API that no longer exists on Node 22), and `other`.
2. THE `removed-api` table SHALL include at least `util.puts`, `util.print`, `util.pump`, `util.error`, `util.debug`, `sys.puts`, `process.EventEmitter` and `os.tmpDir`. Only APIs that are really gone on Node 22 are listed; deprecated-but-present ones (`process.binding`, `require('sys')`) are not, because calling them removed would be false (D-R11).
3. WHEN the corpse's real failing output contains a cause's signature (for example `EBADENGINE` for an engine pin, or the API name for a removed API) THEN that cause SHALL have `seen: true`; otherwise `false`.
4. THE classifier SHALL be deterministic: same two directories, same autopsy.

### 3. The panel shows the reading

**User Story:** As the necromancer, I read the body before I raise it.

1. WHEN an autopsy exists THE panel SHALL show an "The autopsy" section between "The corpse" and "The rites", with the headline "Died at <vital>: <symptom>", and each cause's title, why, file, a `seen` note, and a ruled box of its removed and added lines, as real selectable text.
2. THE section SHALL stay after the body is risen, and SHALL appear in a replay from the recorded event.
3. THE section SHALL use bone and magic inks only, with removed lines marked `−` and added lines `+` (not by colour alone).
4. THE section SHALL carry a dot-matrix slab canvas with an `aria-label`, drawing one still frame under `prefers-reduced-motion`.
5. A "Copy autopsy" button SHALL copy a Markdown report (cause of death, each cause, its diff) and say when it has.
6. THE slab SHALL claim nothing: its light only scans; the number of causes is the only state it reflects.

### 4. Compatibility

**User Story:** As a maintainer, I want old data to keep working.

1. THE `autopsy` event SHALL be optional in the stream: a ritual without one (an old recording, a failed autopsy) reduces and renders as before.
2. THE recorder SHALL record the event with no change, and `redact` SHALL still apply to its text.
3. THE R9 graves SHALL get an autopsy through the same path (their rites show up as diffs).

### 5. Honest, accessible, complete

1. Findings, code and numbers are real text, never dots; every canvas has an `aria-label`.
2. `npm run health` is green; tests live beside their code; an integration test proves each prepared grave's real autopsy.
3. `docs/PRD.md`, `docs/DECISIONS.md` (D-R25), `docs/KNOWN_ISSUES.md` and this spec's `tasks.md` are updated.

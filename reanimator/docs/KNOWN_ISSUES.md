# Reanimator: Known Issues

> Open risks and unknowns for the Reanimator app. IDs are `KI-Rxx` to avoid clashing with Poltergeist's `KI-xx`.
> **Severity:** `Blocker` · `Major` · `Minor`. **Status:** `Open` · `Investigating` · `Resolved` · `Accepted`. Don't delete entries.

| ID | Issue | Severity | Blocks | Status |
|---|---|---|---|---|
| KI-R1 | We haven't chosen the one demo repo (must be small, permissively licensed, genuinely dead on Node 22, quick to revive) | Blocker | R2, demo | Open |
| KI-R2 | Art quality: the original author left, the teammate is vibe-coding, and we can't copy the prototype | Major | R4, costume | Investigating |
| KI-R3 | Dot-matrix render performance (many dots, live frames) | Minor | R4 | Investigating |
| KI-R4 | How exactly Reanimator calls Poltergeist (CLI vs MCP; monorepo wiring) | Major | R3 | Resolved |
| KI-R5 | The revived app needs a spec ("chart") for Poltergeist to test against | Major | R3 | Resolved (practice corpse; the demo repo needs its own) |
| KI-R6 | Eligibility: the idea was prototyped before the window; present the rebuild honestly | Major | submission | Open |
| KI-R7 | Running revive + attack live for a judge may be too heavy; may need a recorded replay | Major | R11 | Resolved (R11 replay, D-R22) |
| KI-R8 | Reviving arbitrary cloned repos runs untrusted code | Major | R9 | Resolved (bubblewrap sandbox, D-R23) |
| KI-R9 | Scene scope: four scenes is a lot for a vibe-coder; which are essential | Minor | R4, R6, R7 | Open |
| KI-R10 | `npm audit`: moderate `minimatch` advisory in the ESLint dev chain | Minor | none (dev-only) | Accepted |
| KI-R11 | Canvas sizing: CSS `100vw/100vh` vs `innerWidth/innerHeight`, and a DPR-only change isn't redrawn | Minor | R1 | Resolved |
| KI-R12 | Backend Origin/Host check before routes run commands | Major | R2, R3 | Resolved |
| KI-R14 | R2 review minors: grandchild-kill test, negative Last-Event-ID, `close` vs `exit`, inherited env, render-check port scope, error-line pick, freePort race, uncancellable serve/render waits | Minor | none (#2, #4 fixed in R3) | Open |
| KI-R16 | R3 review minors: shared engine home between `attack:check` and the server, unbounded `runs/`, UTF-8 split across reads, no Bedrock selection, a lost stream's message shown twice, an abort during prepare still spawns the engine, the integration test's skip check | Minor | none | Open |
| KI-R15 | R3's live run (a real key, a real report with a reproduced wound) hasn't been run; whether the guestbook really yields a wound is unproven | Major | R3 Done-when, R4 | Open |
| KI-R17 | The attack scene restates the engine's viewports (Lich 360×640, else 1280×720); if Poltergeist changes them, minions and wounds land off-target | Minor | R4 accuracy | Open |
| KI-R18 | R4 review minors: the frame throttle can drop a ghost's last (evidence) frame, a pre-spawn frame burns the first slot, labels and dots letterbox slightly differently, loose seq parsing, `lighten` blends red over bone, no test of minion placement in the canvas loop | Minor | none | Open |
| KI-R19 | R5's Done-when (a real Kiro fix + a key-backed re-run closing a wound) hasn't been run; a heal lives only in the ritual's temp dir; the magic seal glow isn't drawn | Major | R5 Done-when, demo | Open |
| KI-R20 | R5 review minors: a heal refused as not-open still counts as an attack (the next one re-raises needlessly); `summoned` echoes the heal target before it's checked | Minor | none | Open |
| KI-R21 | R7's live Kiro cast is unproven: the stream-json envelope, `usage_update`, whether a trust prompt blocks a headless run, and the Done-when (a heal cast → sealed → dared → closed) | Major | R7 Done-when, demo | Open |
| KI-R22 | R7 review minors: split-line test, failure reason from merged output, missing cwd read as not installed, a 409 rejoin replays onto the book, the draft's heal sticks, quill index keys and announce, a late stream after a ritual change, kiroEnv drops proxy/keyring vars | Minor | none | Open |
| KI-R23 | The hosted replay has no recording yet: the real hero run (raise → Death → Kiro heal → closed wound) must be recorded, committed and deployed | Major | R11 Done-when, judging | Open |
| KI-R25 | R9's Done-when (a real, unprepared, permissively licensed GitHub repo raised end to end) hasn't been run; only a local git repo has, in the real sandbox | Major | R9 Done-when | Open |
| KI-R26 | R9 sandbox limits: the network is shared (a grave's scripts can reach the internet, the LAN and every loopback service on the machine), the grave runs on the system Node, the render check's Chromium runs outside the sandbox, the revived dir holds attacker-written files (don't open it in an IDE), no disk cap, and no unprivileged user namespaces means no graves | Major | raising untrusted repos on a machine with other local services | Accepted |
| KI-R27 | R9 review minors: a non-object `dependencies` crashes the rites, the size cap is checked only after the clone (and a host git-lfs filter can fetch first), `files` holds the rite count, the abort test stops at the factory | Minor | none | Open |
| KI-R28 | R6 minors: the graveyard list is read from disk on every request; the three graves are ours, not a real dead repo (KI-R1) | Minor | none | Open |
| KI-R24 | R11 review minors: pause/speed restart a gap, Pause shown after the end, late frames dropped across back-to-back attacks, the Pages build skips typecheck, no test that a replay makes no /api calls, UTC banner date, README in the Pages build | Minor | none | Open |
| KI-R13 | R1 demo-page polish from review: void flash on pitch/mode click, resize jank, late web font, breath jump, no OffscreenCanvas fallback, fractional-DPR cell seams | Minor | R4 (seams) | Open |

---

### KI-R1: Choose the demo repo · Blocker · Open
- **Why it matters:** the whole demo hangs on one repo that reliably goes dead → revived → attacked → healed.
- **What it needs to be:** small; an OSI licence; genuinely fails to install/build/run on Node 22 (e.g. a ~2014–2017 jQuery/Backbone/AngularJS app with Bower/Grunt/Gulp 3/node-sass); quick to revive; and with at least one real, demoable flaw Death can find (a form with no validation, a naive action with a race).
- **Next action:** shortlist 3 candidates, revive each by hand once, pick the most reliable and the most demoable. Keep its before/after in `fixtures/`.
- **Update (2026-11-04, R2):** the raise machinery is built and runs on our practice corpse (D-R14). The real repo drops in as `fixtures/<name>/` with `manifest.json` (`name`, `diedIn`, `licence`, `serve` argv), `corpse/` and `remedy/`. Its corpse must fail at least one vital or the ritual refuses it as "not dead" (D-R15). Prefer one whose install works offline-ish and quickly: install has a 120 s budget.

### KI-R2: Art quality without the original author · Major · Investigating
- **Problem:** the look is the costume angle, the original artist left, and we can't copy their files (D-R2). The teammate is vibe-coding.
- **Plan (also in AGENTS.md § the art):**
  - Build the renderer first (R1) — it does most of the work: feed it a decent source image and it looks good automatically.
  - Make source art the easy way: start from a plain silhouette or an openly licensed / self-made image, then let the ditherer stylise it. The dither hides a lot.
  - Iterate the sprites and scenes with the user in short loops; put screenshots in front of them.
- **Next action:** get R1 rendering one good hero image the team likes before building scenes.
- **2026-11-04 (R1):** the renderer is built, and the demo page renders our own sample SVG (headstone and moon) in `--magic` dots or glyphs at pitch auto/2/3/4/6. Screenshots are in `docs/img/r1-renderer-{dots,glyphs}.png`. **Still needed:** the team runs `npm run dev` and approves or redirects the look (pitch, dot size, gap, gamma). Until then, scenes may still change the defaults.

### KI-R3: Render performance · Minor · Investigating
- **Plan:** compute luminance on a downscaled copy; cache per-cell values; redraw only changed cells; raise `pitch` if it stalls. Target 30fps.
- **Next action:** benchmark R1 with an animated frame at phone and desktop `pitch`.
- **2026-11-04 measurement** (headless Chromium, this dev laptop, 1920×1080, DPR 1, pitch 3 = 230,400 cells, breathing frame): the first full paint is ~147 ms, and the steady state is a **~3 ms/frame** median with `DotRenderer`'s changed-cells-only diff. That's well inside 30 fps. The full repaint after a resize or pitch change is the slow path. Revisit with R4's moving minions, which change more cells per frame.

### KI-R4: How Reanimator calls Poltergeist · Major · Open
- **Problem:** Poltergeist is a sibling package with a CLI (`summon`) and an MCP server. We need to decide how Reanimator invokes it and gets the report.
- **Options:** (a) shell out to the Poltergeist CLI and read `haunting-report.json`; (b) use its MCP server; (c) import its core package directly if the monorepo allows.
- **Next action:** read `../poltergeist/README.md` and `../poltergeist/docs/` during R3 grilling; pick the simplest that returns a report. (a) is likely simplest for a vibe-coder.
- **Resolved (2026-11-04, R3, D-R16):** (a), the CLI `summon` as a subprocess in its own process group, with progress tailed from the run's `events.ndjson` and results read from `haunting-report.json`.

### KI-R5: The revived app needs a chart · Major · Open
- **Problem:** Poltergeist tests against a spec (`requirements.md`). The revived repo won't have one.
- **Plan (D-R8):** hand-write a small chart for the demo repo for v1; later an agent can generate it (the original Reanimator's "Archivist" idea).
- **Next action:** write the demo repo's chart as part of R3.
- **Resolved for the practice corpse (2026-11-04, R3, D-R16):** `fixtures/practice-corpse/chart/` (six EARS criteria + `routes.json`). The real demo repo (KI-R1) needs its own `chart/` folder.

### KI-R6: Eligibility of a prototyped idea · Major · Open
- **Context:** both earlier projects predate the window; this repo doesn't. Code is all fresh (D-R2).
- **Plan:** keep the earlier projects private and unlinked; don't port code; in the write-up, say plainly the idea was prototyped before the event and rebuilt from scratch during it. Confirm the 2026 "new project" wording (Poltergeist KI-05).
- **Next action:** read the 2026 rules.

### KI-R7: Live demo may be too heavy · Major · Resolved (R11 replay, D-R22)
- **Problem:** revive + serve + attack live, in front of a judge, is a lot.
- **Plan:** record a real run as the primary artifact (R11), like Poltergeist's F15; offer live as a bonus.
- **Resolution (2026-11-05):** R11 records the backend's own streams and replays them in the real UI as a static site (D-R22). The recording itself is KI-R23.

### KI-R8: Reviving arbitrary repos runs untrusted code · Major · Resolved (D-R23)
- **Problem:** cloning and `npm install`-ing a stranger's repo executes their scripts.
- **Plan:** v1 avoids this by using one prepared repo (D-R6). For R9, sandbox (container or locked-down runner) before going general.
- **Next action:** only when R9 is attempted.
- **Resolved (2026-11-05, R9):** every command of a grave runs in a bubblewrap sandbox (D-R23); without bwrap no grave is raised. What it doesn't cover is KI-R26.

### KI-R9: Scene scope · Minor · Open
- **Problem:** graveyard, raise, attack, grimoire is a lot of UI for a vibe-coder.
- **Plan:** the raise (R2) and the attack (R4) are essential — they carry the story and the mash-up. Graveyard (R6) and grimoire (R7) are Med; keep them light or stub them for the video.
- **Next action:** build the vertical slice (R0–R5) before any Med scene.

### KI-R10: Dev-only audit advisory · Minor · Accepted
- **Problem:** `npm audit` reports a moderate `minimatch` advisory inside ESLint / typescript-eslint at the pins Reanimator shares with Poltergeist (its KI-28). The suggested "fix" downgrades ESLint to 4.
- **Why accepted:** dev-only; lint never sees untrusted globs; nothing ships to the browser or the backend.
- **Next action:** before submission, check for patched pins and bump both projects together.

### KI-R11: Canvas sizing for R1 · Minor · Resolved
- **Problem (R0 review):** `.stage` is sized `100vw/100vh` in CSS but its backing store uses `innerWidth/innerHeight`; on mobile those differ (address bar), so dots would stretch slightly. Moving the window to a monitor with a different scale fires no `resize`, so the old DPR sticks until the next resize. Invisible on R0's solid fill.
- **Next action:** in R1, size from `canvas.clientWidth/clientHeight` (CSS `width/height: 100%`) and listen for `matchMedia('(resolution: …dppx)')` changes.
- **Resolved 2026-11-04 (R1):** the stage is `width/height: 100%` inside a fixed `.stage-wrap`, sized from `clientWidth/Height × DPR` on a `ResizeObserver`, plus a `matchMedia('(resolution: Xdppx)')` listener that re-arms itself on each DPR change.

### KI-R12: Backend request origin checks · Major · Resolved
- **Problem (R0 review):** the backend binds 127.0.0.1 only (D-R12), but a web page in the user's browser could still send requests to it (CSRF / DNS rebinding). Harmless with only `/api/health`; not harmless once R2/R3 add routes that install, build or attack.
- **Next action:** R2's plan adds Host/Origin validation (allow only the Vite origin and loopback hosts), with tests, before any command-running route.
- **Resolved (2026-11-04, R2):** `server/guard.ts` `loopbackGuard()` on every `/api/*` route: `Host` must be `127.0.0.1`, `localhost` or `[::1]`, and `Origin`, when present, must be a loopback http(s) origin (`null` is refused). Tests in `server/guard.test.ts` and `server/app.test.ts`.

### KI-R13: R1 renderer polish (from the R1 code review) · Minor · Open
- **Findings (2026-11-04, none blocking):**
  1. **Fractional-DPR seams** (`renderer.ts`): `DotRenderer` clears a changed cell with a fractional-pixel rect at DPR 1.25/1.5, which erodes the antialiased edge of the neighbouring dot over time. Fix it before R4's moving scenes: clear on integer pixels and repaint the 4 neighbours.
  2. **Void flash** on each pitch/mode click: the image is re-decoded inside the `[pitch, mode]` effect. Load it once in its own effect.
  3. **Resize jank:** every ResizeObserver callback does a full layout (~147 ms at 1080p). Coalesce them into one rAF.
  4. **Late font:** glyph mode draws once. If JetBrains Mono loads later, the glyphs stay in the fallback font. Redraw on `document.fonts.ready`.
  5. **Breath jump:** the first animated frame jumps from breath(0) to `breath(performance.now())`. Offset by the first rAF timestamp.
  6. **No OffscreenCanvas fallback** (Safari before 16.4 throws, and the error is swallowed, leaving a blank stage). Fall back to `document.createElement('canvas')`.
- **Next action:** fix 1 in R4. Fold 2–6 into the first scene that reuses the App's layout code (R2).
- **Update (2026-11-04, R2):** R2 didn't reuse the R1 demo's layout (the demo moved to `?renderer` unchanged; the raise draws procedural luminance through its own `useDotCanvas`), so 2, 4, 5 and 6 stay with the demo. Item 3 (un-coalesced ResizeObserver layouts) also applies to `useDotCanvas`; fix both together.

### KI-R14: R2 review minors (from the R2 code review) · Minor · Open
- **Findings (2026-11-04, none blocking):**
  1. **No grandchild-kill test** (`server/exec.test.ts`): the hang test kills a single process; the real case is npm → node. Add a test that spawns a grandchild and checks its PID is gone after the timeout.
  2. **Negative `Last-Event-ID`** (`server/app.ts`): `-5` slices from the end of the log and sends negative ids. Clamp with `Math.max(-1, lastId)`.
  3. **`exited` waits for `close`** (`server/exec.ts`): a child that escapes the process group and holds the pipe open would hang `runCommand` past its timeout. Resolve on `exit` plus a short drain.
  4. **Inherited env** (`server/exec.ts`): install scripts and the revived app see the backend's whole `process.env` (Doppler/Anthropic keys). Pass an allowlisted env (`PATH`, `HOME`, `npm_config_*`, `PORT`, `HOST`). **Do this before R3 (the attack needs keys in the backend) and certainly before R9 (untrusted repos, KI-R8).**
  5. **Render check allows any loopback port** (`server/render-check.ts`): restrict it to the app's own origin.
  6. **`firstLine(detail)`** can show a dull npm line instead of the `npm error …` one; prefer the first `npm error`/`ERR` line.
  7. **`freePort` race:** the port is released before the app binds it. Fine locally.
  8. **The serve (15 s) and render (20 s) waits ignore the abort signal**, so stopping mid-serve can take that long. Install and build (the long ones) do abort.
- **Next action:** fix 4 at the start of R3; fold 1–3 and 5–8 into R3's work on the backend.
- **Update (2026-11-04, R3):** #4 fixed (`server/env.ts`: an allowlisted env for every child; only the engine gets the LLM credentials, D-R16). #2 fixed (`server/sse.ts` clamps with `Math.max(-1, id)`). 1, 3 and 5–8 stay open (none block R4).

### KI-R15: R3's live run is unproven · Major · Open
- **Problem:** R3's Done-when needs a real compile (an LLM key), so CI and this session only proved the wiring: the real CLI scouts the risen guestbook and stops at the compiler without a key (`server/attack.integration.test.ts`). Whether the practice corpse's chart really yields a reproduced wound (we expect 1.2 double-submit and 1.3 empty name) is not yet known.
- **Next action:** `cd reanimator && doppler run -- npm run attack:check` (exits 0 with at least one wound; the first run compiles ~36 plans, later runs hit the plan cache in `.reanimator/`). If it finds nothing, tighten the chart's wording, not the app. Then repeat on the real demo repo once KI-R1 picks it.

### KI-R16: R3 review minors (from the R3 code review) · Minor · Open
- **Findings (2026-11-04, none blocking):**
  1. **Shared engine home** (`server/chart.ts`, `server/engine.ts`): `attack:check` and a running backend share `.reanimator/<fixture>/`, so running both at once lets one rewrite the other's config `target`, and the tailer may pick up the other's run (the runId check then fails it honestly). Fix: a per-attack config file name.
  2. **`.reanimator/<fixture>/.poltergeist/runs/` grows without limit.** Prune old runs (keep the plan cache).
  3. **UTF-8 split across reads** (`server/engine.ts` tailer): `buf.toString` before line splitting can turn a split multibyte character into U+FFFD. Use a `StringDecoder`.
  4. **No Bedrock selection:** `AWS_*` reaches the engine, but the written config never sets `provider: "bedrock"`. Add a `REANIMATOR_PROVIDER` passthrough when needed.
  5. **A lost stream shows twice** in `AttackPanel` (as `live.error` and as "Death faltered: …"). Set only one.
  6. **An abort during `prepareAttack` still spawns the engine** (killed at once). Check `signal.aborted` before calling it.
  7. **`it.skipIf(!existsSync(DEFAULT_CLI))`** never skips (the bin is tracked); without `poltergeist/node_modules` the test fails, now with the real "Cannot find package" line. Check for the engine's `node_modules` instead.
  8. **Proxy/CA vars** (`HTTPS_PROXY`, `NODE_EXTRA_CA_CERTS`) are dropped by the child env allowlist, including for `npm install`. Fine locally; add them if a demo machine needs a proxy.
- **Next action:** fold into R4/R5's backend work.

### KI-R17: The attack scene's restated engine viewports · Minor · Open
- **What:** `src/attack/scene.ts` maps a ghost's `x,y` onto the body using `VIEWPORTS` (`lich` 360×640) and `DEFAULT_VIEWPORT` (1280×720, Playwright's default for a context with no viewport). These are copies of Poltergeist's `personas/devices.ts` and runner defaults, because Reanimator never imports the engine (D-R16).
- **Risk:** if the engine adds a device preset or sets a viewport, minions and wounds land in the wrong place. Real verdicts are unaffected; it's only where they're drawn.
- **Next action:** if it bites, have the engine put the viewport in `ghost.spawned` (an engine change, Poltergeist-side), and read it from there.

### KI-R18: R4 review minors (from the R4 code review) · Minor · Open
- **Findings (2026-11-05, none blocking; the review's three Important items were fixed before merge):**
  1. **The frame throttle keeps the first mark of each second, never the last** (`server/engine.ts` `frameThrottle`). At the engine's 4 fps, a ghost's final frames are usually dropped, so after the attack the evidence body can be up to ~1 s before the end. Fix: remember the latest skipped mark per ghost and forward it on `rep.finished` or at the final poll.
  2. **A frame mark can come before its ghost's `ghost.spawned`** (the engine starts the screencast first). The reducer ignores it, but it still uses up the throttle slot, so the first body frame is ~1 s late. Fix: don't record the throttle time for a ghost the tail hasn't seen spawn.
  3. **Labels and dots letterbox a little differently** (labels use `containRect` over the stage's CSS size; dots use the rounded `bodyRect` over the dot grid). A few px at most.
  4. **`Number(seq)` in the frame route accepts `0x2`, `2.0` and `1e0`** as seq 2. Harmless; `/^\d+$/` would be stricter.
  5. **`mix-blend-mode: lighten`** gives a per-channel max where red dots sit over bone dots, which is neither ink. Raise it at the look sign-off (KI-R2).
  6. **No test drives the canvas `lum` callbacks**, so minion placement, the idle slots and the 12-minion cap are tested only through the pure helpers.
- **Next action:** fold #1 and #2 into the next backend change (R5 kept to its scope and didn't take them, 2026-11-05); the rest when touched.

### KI-R19: R5's heal loop is unproven end to end · Major · Open
- **What (2026-11-05):** R5 is built (D-R20) and tested with a fake engine and fake vitals. A real re-raise is also tested, serving an edited body (`server/heal.integration.test.ts`). Still open:
  1. **The Done-when itself:** a real wound (KI-R15, needs a key), fixed by Kiro from the brief, then **Dare Death again** closing it on a clean re-run. This needs the batched Kiro session (D-R18).
  2. **A heal lives only in the ritual's temp dir.** A new ritual (or a backend restart) deletes the fix. Exporting it as a branch, patch or PR text (D-R10, the story's close) is not built.
  3. **The magic seal glow** over a part whose wounds are all closed (THEME §6) isn't drawn. The gash dissolves, but there's no `--magic` on the canvas.
  4. **Healed and unproven wounds live in the backend's memory** (`Attacks`). After a restart, a healed pair just isn't listed, and an unproven one drops out of the open list until the next full attack.
  5. **`npm run -s health` fails the ritual integration test:** `npm_config_loglevel=silent` leaks into the corpse's `npm install`, which then prints nothing (the inherited env of KI-R14). Use `npm run health`.
- **Next action:** #1 in the Kiro session after KI-R15; #2 with the "send it to the living" work; #3 at the look sign-off (KI-R2); #4 with #2; #5 with KI-R14. The keyed run should have two or more wounds and heal one, so the ledger's carry-over is seen for real.

### KI-R20: R5 review minors (from the R5 code review) · Minor · Open
- **Findings (2026-11-05; the review's Critical and Important were fixed before merge, see D-R20):**
  1. **A heal refused as "not open" still counts as an attack** (`server/attack.ts`, `memory.attacks++`). The next attack then pays for a needless re-raise (an `npm install`). Fix: count it only once a re-raise or the engine has run.
  2. **`summoned` echoes the heal target before the open check.** The panel flashes "Death returns for X · Y…" until the `failed` lands. Fix: check first, then emit.
- **Next action:** when `server/attack.ts` is next touched.

### KI-R21: R7's grimoire has never cast on the real Kiro · Major · Open
- **What (2026-11-05):** R7 is built (D-R21) and tested only against `server/fixtures/fake-kiro.mjs`, because Kiro's tokens are saved for the demo. These are still unknown:
  1. **The stream-json envelope.** The parser accepts `params.update`, `update`, or a bare update, and reads the seal from `result.stopReason`, a top-level `stopReason`, or exit 0. The real lines may differ.
  2. **Whether `usage_update` arrives.** If it doesn't, the candle stays unlit (honestly).
  3. **Whether a headless run blocks:** on a workspace-trust prompt (the revived dir is a new temp dir; `--trust-workspace` is V3-only), or on a tool that isn't in `--trust-tools`. A block ends in the 10-minute timeout or **Break off the spell**.
  4. **Whether `--resume` picks up the ritual's conversation** in that dir.
  5. **The Done-when:** a real wound (KI-R15) cast in the grimoire, Kiro editing the body, the seal, then **Dare Death again** closing it (with KI-R19 #1).
- **Next action:** in the batched Kiro session, run `npm run server` (real `kiro-cli` on PATH, logged in) and `npm run dev`, raise the corpse, and cast a short spell. If the grimoire stays blank, save a few lines of `kiro-cli chat --output-format stream-json` output and fix `toSpellEvents` (`server/kiro.ts`). Then run the Done-when.

### KI-R22: R7 review minors (from the R7 code review) · Minor · Open
- **Findings (2026-11-05; the review's Important ones were fixed before merge, see D-R21):**
  1. **No test splits one JSON line across two stdout chunks, or puts many lines in one** (`server/kiro.ts` `onOutput`). The code handles both; only a split UTF-8 character is tested.
  2. **A failed turn's reason comes from the merged stdout+stderr tail**, so a crash mid-stream can show a raw JSON line. Track stderr separately.
  3. **A missing cwd also reads as "kiro-cli is not installed"** (both are `spawn … ENOENT`). This is rare, since the body exists while risen.
  4. **A 409 rejoin replays onto the book:** a second tab, or a re-cast after a lost stream, reconnects to the running spell from index 0, so its pages show twice. A second tab's own text is silently dropped.
  5. **The draft's heal sticks:** after a heal spell, a free-form spell from the same form still carries that wound (and offers its dare). Clicking **Cast in the grimoire** on the same wound again doesn't re-seed the form, and clicking it mid-typing discards the text. Fix: clear the draft on cast, and key the form by a counter.
  6. **The quill:** pages are keyed by index, so a new ritual's quill at the same index keeps the old reveal count. A long reply trails the seal by seconds, and `aria-live` on the whole section announces the reveal letter by letter.
  7. **A cast whose POST resolves after the ritual changed** opens a stream for the old ritual that is only closed on the next change or unmount.
  8. **`kiroEnv` drops `HTTPS_PROXY`, `SSL_CERT_FILE`, `KIRO_*` and `DBUS_SESSION_BUS_ADDRESS`.** Kiro behind a proxy or using keyring login may fail. Check this during KI-R21's live run.
- **Next action:** #8 with KI-R21. The rest when `src/grimoire/` or `server/kiro.ts` is next touched.

### KI-R23: The hosted replay has no recording yet · Major · Open
- **Context:** R11 is built (D-R22), but nothing real has been recorded. A synthetic session would break D-R11, so the hosted page says "No recording yet".
- **Blocked on:** the demo repo (KI-R1), a key-backed attack (KI-R15) and the Kiro heal (KI-R19, KI-R21), so it fits the batched Kiro session.
- **Steps:**
  1. Start the backend with recording on: `REANIMATOR_RECORD=public/recording doppler run -- npm run server` (from `reanimator/`), plus `npm run dev`.
  2. Run the hero run once, in one sitting: **Begin the ritual** → **Summon Death** → **Cast in the grimoire** on a wound → **Dare Death again** until it closes. Then stop the server.
  3. Check it: `npx vite --open '/?replay'`, then the size (`du -sh public/recording`, frames are capped at 50 MB), and that nothing private leaked. The recorder already blanks the values of every `*KEY*`/`*TOKEN*`/`*SECRET*`/`*PASSWORD*`/`*AUTH*` env var to `[secret]` and replaces the home dir with `~`, but the recording keeps full vital output, engine errors, Kiro's text and diffs. Run `grep -rE "$HOME|$USER|sk-|ghp_|_authToken|AKIA" public/recording` (it should print nothing), and skim `events.ndjson` once before committing.
  4. Commit `public/recording/`. Enable GitHub Pages (Settings → Pages → Source: GitHub Actions), then run **Reanimator replay (GitHub Pages)** from the Actions tab.
- **Done when:** the public Pages URL plays the hero run end to end in a fresh browser (R11's Done-when).
- **Not covered by tests:** the recorder is unit-tested against fake logs. A real session (with real frame timing and a 409 rejoin) hasn't been recorded yet.

### KI-R24: R11 review minors · Minor · Open
- **Context:** the final review of R11 (2026-11-05). The two Important findings (a failed write could crash the live backend; secrets in published output) and the empty recording that would show a "RECORDED RUN" banner were fixed before merge (D-R22).
  1. **Player clock:** pausing, or changing speed, restarts the current gap (at most 2 s). When playback ends, the button still says Pause.
  2. **Late frames:** a frame read that resolves after the next attack has started returns null, so the last frames of an attack followed at once by a heal can be dropped. The replay just keeps the previous image.
  3. **The Pages workflow** builds without `npm run typecheck`.
  4. **No test asserts** that a replay makes no `/api` calls. It holds by construction, because the live hooks never mount.
  5. **The banner date** is `recordedAt`'s UTC date.
  6. `public/recording/README.md` ships in the Pages build. That's harmless.
- **Next action:** #2 and #3 before KI-R23's recording session. The rest when `src/replay/` is next touched.

### KI-R25: R9 hasn't raised a real stranger's repo · Major · Open
- **Context:** R9 is built (D-R23). Its integration test raises a dead package from a local git repo through the real clone, the real bwrap sandbox, the `engines` rite, real npm and headless Chromium. No real GitHub repo has been raised yet: that needs the network and runs third-party code, so it's a hand check.
- **Steps:** `npm run server` and `npm run dev`, paste the URL of a small, MIT/ISC/Apache, dependency-light JS repo last touched around 2015–2019 that has a `start` script or a built `index.html`, and press **Begin the ritual**.
- **Done when:** one unprepared, permissively licensed repo goes flatline → rites → four beating vitals → served in the iframe (R9's Done-when). Note the repo and the rites it took here.
- **Watch for:** installs over 120 s (the vital times out), repos whose death is code-level (no rite fits; that's the grimoire's), and `start` scripts that ignore `PORT`/`HOST` (serve times out).

### KI-R26: R9 sandbox limits · Major · Accepted
- **Context:** the bubblewrap sandbox (D-R23) keeps a grave's own commands off the host's files, home, secrets and processes. It does not:
  1. **isolate the network.** It's shared, so install scripts and the served app can reach the internet, the LAN and every loopback service on the machine. That includes this backend, which only checks Host/Origin (KI-R12). The review (2026-11-05) showed a grave could call the spell route and run Kiro unsandboxed on the host; that is closed (Kiro and Death both refuse graves), so this backend now only lets a grave start a new ritual. Any *other* local service (a dev database, another dev server) is still in reach. Splitting the network needs a netns with user-mode networking (pasta/slirp4netns) and a port forward for the app.
  2. **choose the Node.** A grave runs on `/usr/bin/node` (the system's), not the shell's (mise/nvm). On a machine whose system Node isn't 22, "dead on Node 22" means dead on that Node.
  3. **sandbox the render check.** Chromium runs on the host, but it only loads loopback and aborts every other request (D-R15).
  4. **work everywhere.** Where unprivileged user namespaces are off (e.g. Ubuntu 24.04's AppArmor default), `bwrap` fails, and graves are refused with the no-sandbox message. The integration and sandbox tests skip there, so CI may not run them.
  5. **make the revived dir safe to open.** It holds the grave's files and `.git`, which the sandboxed install may have rewritten (e.g. `core.fsmonitor`). Opening it in an IDE that runs git means running the grave's config on the host.
  6. **cap disk.** A grave's `node_modules` lands in the work dir under `/tmp`, which is RAM on some machines.
- **Next action:** raise graves only on a machine with nothing sensitive listening on loopback, for the demo. Fix #1 (netns + pasta) before graves are raised anywhere shared.

### KI-R27: R9 review minors · Minor · Open
- **Context:** the final review of R9 (2026-11-05). The Critical finding (a grave driving Kiro through the backend) and two Important ones (the rites writing through symlinks; a sandbox without npm calling a repo dead) were fixed before merge (D-R23).
  1. `"dependencies": "x"` (not an object) makes `'node-sass' in deps` throw, so the ritual fails with a raw TypeError. Guard with `typeof deps === 'object'`.
  2. The 100 MB cap is checked after the clone has finished. A host-wide git-lfs smudge filter would also fetch LFS objects first. Consider `GIT_LFS_SKIP_SMUDGE=1` and `--filter=blob:limit=`.
  3. The `remedy` event's `files` is the rite count for a grave.
  4. The abort test stops at the fixture factory. That the git group is killed rests on `runCommand`'s own abort tests.
- **Next action:** #1 and #2 when `server/rites.ts` / `server/grave.ts` are next touched.


### KI-R28: R6 minors · Minor · Open
- **Busy backend:** a pick while a ritual is running is refused with a reason (it is never swapped for the running ritual); a reload mid-ritual therefore waits for it to end.
- **Disk read per request:** `listGraves` loads every manifest on each `GET /api/graveyard` and each `grave` POST. Fine for a handful of fixtures.
- **Ours, not real:** all three headstones are our own written graves (D-R14); the real dead repo is still KI-R1.

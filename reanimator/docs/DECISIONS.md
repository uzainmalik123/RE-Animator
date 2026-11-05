# Reanimator: Decisions

> Decisions for the Reanimator app. IDs are `D-Rxx` to avoid clashing with Poltergeist's `D-xx`. To change a decision, don't edit it: add a new one and mark the old one `Superseded by D-Rxx`.
> Status: `Accepted` · `Proposed` · `Superseded`

| ID | Decision | Status |
|---|---|---|
| D-R1 | The entry is **Reanimator**, submitted in **Frankenstein**; Poltergeist is its red-team engine ("Death") | Accepted |
| D-R2 | Fresh code only. Nothing is copied from the earlier Reanimator prototype or from `poltergeist-old` | Accepted |
| D-R3 | The art is the earlier prototype's **dot-matrix / glyph dither** style, rebuilt from the technique, with all-new assets | Accepted |
| D-R4 | Poltergeist is **headless** inside Reanimator. Reanimator draws all the UI; Poltergeist is called, never re-implemented | Accepted |
| D-R5 | Each Poltergeist persona = one class of adversarial test ("Death's minion"), using the engine's existing safe mechanisms | Accepted |
| D-R6 | v1 revives **one prepared demo repo** with real vitals; arbitrary GitHub URLs are a stretch goal (R9) | Accepted |
| D-R7 | The revived app is served on **localhost**, so Poltergeist (localhost-only by design) can attack it | Accepted |
| D-R8 | Reanimator supplies Poltergeist a **spec of the revived app** (the "chart"); hand-written for the demo repo in v1 | Accepted |
| D-R9 | Stack: Vite + React + TypeScript + Canvas, with a small Node backend to run revive/attack. Pin versions | Superseded by D-R12 |
| D-R10 | Humans open PRs. Reanimator produces a branch/patch/PR text; it never opens PRs on third-party repos | Accepted |
| D-R11 | Nothing is faked for the camera: a pulse = real vitals, a wound = a real finding, a heal = a real fix + re-run | Accepted |
| D-R12 | Stack confirmed and pinned in R0: one standalone package, Vite 8 + React 19 UI, Hono backend on 127.0.0.1:7070, own CI workflow | Accepted |
| D-R13 | The R1 renderer: a pure dither core plus thin canvas painters in `src/render/`, with a cached `DotRenderer` for animation | Accepted |
| D-R14 | R2 is built repo-agnostic and proven on our own **practice corpse**; the real demo repo (KI-R1) is a drop-in fixture | Accepted |
| D-R15 | The ritual protocol: a real flatline from the untouched corpse, "not dead" refused, vitals stop at the first failure, SSE with resume, one ritual at a time | Accepted |
| D-R16 | Calling Death: the Poltergeist CLI as a subprocess, the fixture's chart copied into the revived repo, a persistent per-fixture engine home, an allowlisted env | Accepted |
| D-R18 | R6, R8 and R10 are built in **Kiro** (spec-first), last; Claude Code never builds them | Accepted |
| D-R17 | The attack protocol: `POST /api/rituals/:id/attack` + SSE, a wound = a haunted pair, one attack at a time, a new ritual stops it first | Accepted |
| D-R19 | The R4 attack scene: live ghosts and the engine's own frames, Death + minions + wounds on a red layer over a bone body | Accepted |
| D-R20 | The R5 heal loop: a brief per wound for Kiro (the user hands it over), a re-raise on real vitals before every attack but the first, a one-wound re-run, the merged report as ledger, and a wound closes only on a clean pair that really ran | Accepted (one bullet amended by D-R21) |
| D-R21 | The R7 grimoire drives the real Kiro agent: one headless `kiro-cli chat` turn per spell in the revived body, file tools only, never while Death attacks; the user still dares Death | Accepted |

---

### D-R1: Reanimator / Frankenstein, with Poltergeist as the engine
- **Context:** the team had two ideas (Reanimator = revive dead repos; Poltergeist = adversarially test an app from its spec). The original Reanimator was started before the hackathon and can't be submitted; this repo (Poltergeist's, started at kickoff) is eligible. So the merged product is built here.
- **Decision:** one entry, **Reanimator**, in **Frankenstein** (a mash-up of two systems). Poltergeist becomes the red-team phase ("Death attacks the revived repo"). Costume is a secondary angle given the art.
- **Consequences:** the repo now holds two sibling projects, `poltergeist/` (engine) and `reanimator/` (app + art + story). See the repo-root `AGENTS.md`.

### D-R2: Fresh code only
- **Context:** both the earlier Reanimator prototype (`../../reanimator`) and `../../poltergeist-old` were started before the hacking window, so their code is ineligible.
- **Decision:** write all Reanimator code fresh, inside the window. Do **not** copy or port files, assets, images, models or sound from either. The *concepts, story and technique* are the team's own and carry over through these docs.
- **Consequences:** the art is rebuilt from the description in THEME.md, not lifted. Assets are made new (see AGENTS.md § the art).

### D-R3: The dot-matrix art style, rebuilt
- **Decision:** adopt the earlier prototype's look — everything drawn as Bayer-dithered dots/glyphs on black, only magic glowing — as *the* look of the entry. Rebuild the renderer from THEME §3.
- **Why:** the team wants this style 100%, and it's distinctive and on-theme.
- **Consequences:** THEME.md is binding. New risks: KI-R2 (art quality without the original author), KI-R3 (render performance).

### D-R4: Poltergeist is headless here
- **Decision:** in the merged product, Poltergeist has no UI of its own. Reanimator renders everything (including Death's attack, which visualises a Poltergeist run). Reanimator calls Poltergeist via its CLI or MCP and reads its report.
- **Consequences:** Poltergeist's own Séance UI and "haunted terminal" costume are **dropped from the entry** (recorded on the Poltergeist side too). One look only: the necromancer style.

### D-R5: Personas are classes of adversarial test
- **Context:** the team wants each persona to represent one kind of red-team attack (e.g. input-injection-style testing).
- **Decision:** keep the six personas (Wraith, Banshee, Doppelgänger, Lich, Revenant, Changeling) as Death's minions, each a class of adversarial/robustness test against the revived app **you own**:
  - Banshee → malformed/injection-style inputs from the engine's **vetted static list** (the model never writes payloads — Poltergeist D-04);
  - Wraith → impatient double-submit/navigation;
  - Doppelgänger → concurrency/race;
  - Lich → slow/constrained device;
  - Revenant → stale session/auth;
  - Changeling → keyboard-only reachability.
- **Boundary:** this is QA/robustness/defensive testing of the app the user just revived and controls, run on localhost. It is **not** an exploit generator or a tool pointed at anyone else's systems (Poltergeist D-08, F25 stays scrapped).
- **Why it's safe and honest:** findings are real flaws in the user's own code, found with known probe inputs; fixing them hardens the revived project. That's the whole story (STORY § The reckoning / The healing).

### D-R6: v1 revives one prepared repo
- **Decision:** ship with one small, permissively licensed demo repo that genuinely fails on Node 22 and is quick to revive. Keep its before/after so the demo is reliable. Arbitrary URLs are R9 (Low).
- **Why:** a vibe-coded build can't take on the full clone-anything revive engine in the time. A reliable, real single-repo demo beats a flaky general one.

### D-R7: The revived app runs on localhost
- **Decision:** the revive serves the app at a localhost origin. This is also what lets Poltergeist attack it (Poltergeist refuses non-loopback targets by design — its D-05).

### D-R8: Reanimator gives Poltergeist a chart (spec)
- **Decision:** Poltergeist tests against a spec. Reanimator provides one describing the revived app (the "chart", borrowing the original Reanimator's idea). For v1 it's hand-written for the demo repo; later an agent can write it.

### D-R9: Stack (proposed) · Superseded by D-R12
- **Proposal:** Vite + React + TypeScript for the app, Canvas 2D for the renderer, and a small Node backend (Express or Hono) to run revive and attack commands and stream status. Pin versions. Confirm once scaffolding (R0).

### D-R10: Humans open PRs
- Inherited from the original Reanimator. Reanimator outputs a branch, a patch and a PR description. A person decides whether to send it. No unsolicited PRs on third-party repos.

### D-R11: Nothing faked for the camera
- Inherited and central to the story's integrity (STORY § Tone). A pulse means vitals passed, a wound means a finding reproduced, a heal means a real fix plus a real re-run passing.

### D-R12: Stack confirmed and pinned (R0) · supersedes D-R9
- **Decision (from the R0 grill, 2026-11-02):**
  - `reanimator/` is **one standalone npm package** (not a workspace of Poltergeist): `src/` = Vite + React UI, `server/` = Hono backend.
  - **Exact pins**, no ranges. Shared tools match Poltergeist (TypeScript 5.9.3, Vitest 4.1.12, ESLint 9.39.1, typescript-eslint 8.72.1). Full list in `STACK.md`.
  - **Backend = Hono** (`createApp()` in `server/app.ts`), started by `server/main.ts` on **127.0.0.1:7070 only**. It will run install/build/attack commands, so it must never listen on the LAN.
  - `npm run dev` = Vite on 5173 (strict port), proxying `/api` to 7070. `npm run server` starts the backend. No combined runner yet (YAGNI).
  - Two tsconfigs: `tsconfig.app.json` (DOM, bundler, JSX) for `src/`; `tsconfig.node.json` (NodeNext) for `server/` and configs. `typecheck` runs both.
  - Tests are Vitest in the **node** environment; UI smoke tests use `react-dom/server` (no jsdom until a feature needs a DOM).
  - CI is its own workflow, `.github/workflows/reanimator-ci.yml`, separate from Poltergeist's.
- **Consequences:** R1 draws onto the existing `.stage` canvas in `src/App.tsx`; R2/R3 add routes to `createApp()`.

### D-R13: The R1 renderer's shape
- **Decision (from the R1 grill, 2026-11-04):**
  - `src/render/dither.ts` is **pure** (no canvas): `gridSize`, `luminanceGrid` (Rec. 709, alpha-weighted, gamma 1.2), `ditherLevels` (`floor(v·(steps−1) + (BAYER4+0.5)/16)`, clamped, NaN = dark), and `levelsToText`. It runs in Vitest's node env, and an inline glyph snapshot pins it.
  - `draw.ts` paints levels: `drawDots` / `drawGlyphs` (from an image) and `drawLevelsAsDots` / `drawLevelsAsGlyphs` (from levels). Level 0 draws nothing. Dot radius is `((pitch−gap)/2)·(0.4+0.6·level/(steps−1))`, and the defaults are steps 4, gap 1 CSS px, circles. Glyphs use the ramp `" .:-=+*#%@"` in JetBrains Mono.
  - Everything is laid out in **CSS px × `scale` (DPR)**. Pitch is 2 under 640 CSS px wide and 3 otherwise (`pitchFor`).
  - `DotRenderer` keeps the last frame's levels and repaints only changed cells. A new grid size or `reset()` repaints everything. Scenes sample an image once per layout and modulate luminance per frame (cheap), rather than re-sampling every frame.
  - The palette is one ink per draw call, so `--magic` and `--death` can't mix on one element. `readPalette` reads the CSS tokens.
  - Images are fitted with **contain** (`containRect`) so the art never stretches.
- **Consequences:** R2/R4 scenes compose a source image (or build a luminance grid directly) and hand it to `DotRenderer`. Real text stays in HTML over the canvas.

### D-R14: R2 runs on a practice corpse until the demo repo is picked
- **Context:** R2's grill (2026-11-04). KI-R1 (the real demo repo) is still open, and picking it needs a shortlist, a hand-revive of each and the team's taste. R2's machinery doesn't depend on which repo it is.
- **Decision:**
  - The raise is **repo-agnostic**. A fixture is `fixtures/<name>/` with `manifest.json` (`name`, `diedIn`, `licence`, `serve` argv), `corpse/` (the untouched dead repo) and `remedy/` (files laid over a copy of the corpse to revive it). No patch tooling.
  - v1 ships **`fixtures/practice-corpse`** (`guestbook-2016`), which we wrote inside the window under MIT. It is a dependency-free 2016-style `http` guestbook that genuinely dies on Node 22 in two ways: `engines: node 0.10.x` + `engine-strict` (npm `EBADENGINE`) and `util.puts` (removed). The remedy is a modern `engines` field and `console.log`. No other bugs are planted.
  - It is a **practice** corpse: honest about being ours, and it's what the tests and the dev loop run. The demo's "died 2016" headstone belongs to the real repo once KI-R1 picks it.
- **Consequences:** swapping in the real demo repo means adding a fixture folder and pointing `server/main.ts` at it (R6 will make that a choice). R2's Done-when ("the demo repo goes from failing to served") is met on the practice corpse; the real repo's run stays on KI-R1.

### D-R15: The ritual protocol
- **Context:** R2's grill (2026-11-04). D-R11 says nothing is faked; the flatline has to be as real as the pulse.
- **Decision:**
  - **Vitals** (`server/vitals.ts`) run in order and stop at the first failure: `install` (`npm install --no-audit --no-fund`, 120 s), `build` (`npm run build --if-present`, 120 s), `serve` (the manifest's argv on a free 127.0.0.1 port with `PORT`/`HOST`, polled until HTTP 2xx, 15 s, failing fast if the process exits), `render` (headless Chromium via `playwright-core` 1.64.1 with non-loopback requests aborted; passes with no page errors and some body text, 20 s). Commands are argv arrays, never a shell. Each runs in its own process group so a timeout kills everything it spawned. Output is kept to the last 4 KB.
  - **The ritual** (`server/ritual.ts`): copy the corpse to a fresh temp dir and run the vitals: that failure is the flatline. **If the corpse passes every vital, the ritual refuses: "not dead".** Otherwise copy again, overlay the remedy, and run the vitals: all pass = `risen` with the origin; any failure = `failed` with `<vital>: <first line>`.
  - **One ritual at a time** (`409`). The revived app keeps running for Death (R3) until the next ritual starts (which stops it first) or the backend gets SIGINT/SIGTERM (`Rituals.dispose()`); work dirs are removed with it.
  - **Transport:** `POST /api/rituals` → `202 {id}`; `GET /api/rituals/:id/events` is SSE with `id: <index>`, which honours `Last-Event-ID` so a reconnect never double-counts a vital. One pure `reduceRitual` in `shared/ritual.ts` folds events on both sides.
  - **The scene** (`src/raise/`): a spell circle (`--magic`) whose brightness is `beats/4` (floor 25% once started) and a heart monitor that is a `--death` flatline until the first revived vital passes, then a `--magic` pulse; one ink per canvas. Facts are real text in the panel; the revived app shows in an iframe. Reduced motion draws still frames. The R1 demo moved to `?renderer`.
- **Added after review (2026-11-04):** each ritual has an `AbortController`. A new ritual or `dispose()` aborts the running one (its npm command's group is killed, later vitals are skipped, and any started app is stopped) instead of waiting for it to finish. A check that throws (e.g. Chromium missing) is a failed vital, never an orphaned app. A `409` carries the running ritual's id so a reloaded page rejoins it, and a stream the browser gives up on frees the UI with "lost the ritual".
- **Consequences:** R3 attacks `state.origin` from the risen ritual. The revived app's port is chosen at random, not 7100+ (STACK updated). The backend now needs Chromium (CI installs it).

### D-R16: Calling Death (the Poltergeist engine)
- **Context:** R3's grill (2026-11-04), resolving KI-R4 (how to call it) and KI-R5 (the chart).
- **Decision:**
  - **CLI subprocess.** The backend runs `node ../poltergeist/packages/cli/bin/poltergeist.js summon --spec <dir> --config <file> [--only ids]` (`REANIMATOR_POLTERGEIST` overrides the path) through `runCommand`, so it has its own process group, a 15-minute timeout and an abort. We don't import `@poltergeist/core`: tsc would typecheck the engine's sources, and an engine hang would hang the backend. Exit 0/1 with a new run dir = a report, read only if its `runId` is that run's (a crash also exits 1, and an earlier run's report may still sit beside the spec); anything else = failed with the CLI's `error:` line or last words.
  - **The chart** is hand-written per fixture in `fixtures/<name>/chart/` (`requirements.md` in Kiro's EARS format + `routes.json`). It states what any such app should do; the app is never changed to fit it (no planted bugs, D-R14). The practice corpse's has six criteria (signing once, refusing an empty name, showing text as written, keyboard-only, small slow phone).
  - **Where files live:** the chart is copied into the revived repo at `.kiro/specs/chart/` (once per ritual, so re-runs merge into its report, Poltergeist F14, and Kiro sees it in R5). The config and the engine's `.poltergeist/` (plan cache, runs) live in `reanimator/.reanimator/<fixture>/` (gitignored), with the config rewritten each attack: `{ target: <risen origin>, routes, concurrency: 6, reps: 3 }`. The plan cache key has no origin in it, so cached plans survive a new ritual's random port.
  - **Env:** every child gets an allowlist (`childEnv`: `PATH HOME TMPDIR TEMP LANG LC_ALL TERM USER SHELL npm_config_*`); only the engine also gets `ANTHROPIC_*`, `AWS_*`, `PLAYWRIGHT_BROWSERS_PATH`, `XDG_CACHE_HOME` and `NO_COLOR=1` (`engineEnv`). Fixes KI-R14 #4.
  - **Progress** is the run's own redacted `events.ndjson`, tailed every 250 ms (whole lines only); Reanimator keeps four event types (`run.started`, `scout.route`, `plan.compiled`, `verdict.criterion`).
- **Consequences:** CI installs `poltergeist/` too and runs the real CLI with no key (it must stop at the compiler). A real report needs a key: `doppler run -- npm run attack:check` (KI-R15). R4 draws from these events and wounds; R5 re-runs with `only`.

### D-R17: The attack protocol
- **Context:** R3's grill (2026-11-04).
- **Decision:**
  - `POST /api/rituals/:id/attack` (optional JSON `{ only: string[] }`) → `202 {id}`; `409 {error:'Death is already attacking', id}` (rejoin); `409 {error:'the ritual has not risen'}`; `400` for a bad `only`. `GET /api/attacks/:id/events` is SSE with the ritual's resume semantics (`server/sse.ts`, shared).
  - Events (`shared/attack.ts`): `summoned` → `engine` (the four engine events) → `finished {counts, wounds}` or `failed {reason}`, folded by one `reduceAttack`.
  - **A wound is a haunted pair** from the real report (it reproduced, Poltergeist D-06). Flaky, inconclusive and clean pairs only reach the counts.
  - **One attack at a time**, on the current risen ritual. A new ritual or shutdown stops it first (`Rituals` `onRelease` → `Attacks.stop()`, which kills the engine's group) and it ends `failed: stopped: a new ritual began`.
  - **The R3 panel** is real text only (a **Summon Death** button, progress, the wounds in `--death`); the attack art is R4's.
- **Consequences:** R4 folds the same stream into the scene; R5 posts `{only}` for a re-run.

### D-R18: Some features are built in Kiro
- **Context (2026-11-04):** judging weighs how well Kiro is used, and the write-up must truthfully list what Kiro did. So far the code has been written in Claude Code, and the user is saving Kiro tokens for one batched session near the demo. A Kiro review at the end alone would be thin.
- **Decision:**
  - **R6 (graveyard), R8 (autopsy) and R10 (sound & atmosphere) are built in Kiro**, spec-first: Kiro writes the spec (`requirements.md`, `design.md`, `tasks.md`) and implements it, and its output is committed as it is. Poltergeist's F10 Candy Swap is already Kiro-only (D-10).
  - They're self-contained, off the critical path (the vertical slice R0–R5 doesn't need them), and they show Kiro's spec workflow on the product itself.
  - They move to the **end** of the build order. **Claude Code sessions never grill, plan, implement or review them**, and nothing Claude Code builds depends on them. If asked, they stop and remind the user (AGENTS hard rule 7).
  - The same Kiro session also does: the Candy Swap build (KI-44), the real heal loop through Poltergeist's MCP tools (R5's demo; KI-51, KI-65), one project hook in this repo (e.g. run `npm run health` on save), and a final whole-app Kiro review.
- **Consequences:** the write-up can honestly say Kiro built three Reanimator features and the demo target, and heals wounds live. R6's fixture choice in `server/main.ts` stays a hard-coded practice corpse until Kiro builds R6.

### D-R19: The attack scene (R4)
- **Context:** R4's grill (2026-11-05), run with the recommended answers.
- **Decision:**
  - **Live, not from the report alone.** The tail also forwards `ghost.spawned`, `ghost.step` (only its `x,y`, kept when both are numbers), `rep.finished` and frame marks from the run's `frames.ndjson`, at most one a second per ghost. `reduceAttack` folds them into `ghosts` (a 3-point trail each). Wounds still come only from the report (D-R17).
  - **The body is the engine's own frames** of the app under attack (its CDP screencast jpgs), served by `GET /api/attacks/:id/frames/:ghostId/:seq` from the current attack's run dir only (the ghost id is one safe path segment, and seq is a non-negative integer). The cross-origin iframe can't be sampled, and a separate screenshot would need a second Chromium. Before the first frame, there's no body: Death arrives over the void.
  - **Which frame:** the earliest-spawned ghost still running that has a frame; after the attack, the first wound's ghost (its evidence), else the last ghost seen.
  - **Placement:** a minion sits at its ghost's last `x,y` ÷ its viewport (the Lich 360×640, the rest Playwright's default 1280×720, restated in `src/attack/scene.ts`, KI-R17). An unplaced ghost waits in a fixed slot along the bottom, with at most 12 shown. A wound opens where a ghost of its pair last acted (the latest rep wins), else in a fixed slot on the right.
  - **Layers:** the attack scene replaces the raise stage once Death is summoned (fresh per attack). It's two one-ink canvases, the body in `--bone` and the red layer (vignette, Death from `public/art/death.svg`, minion sprites from THEME §6, ▓▒░ wound gashes) in `--death`, blended with `lighten`. Wound labels (`1.2 · wraith`) are positioned real text. Death ramps in over 1.5 s, and the stage fades in over 400 ms. With reduced motion, everything appears instantly and minions leave no trail.
  - `useAttack` now lives in `RaiseScene` and is tagged with its ritual, so the panel and the scene share one state. `useDotCanvas` moved to `src/render/` for both scenes.
- **Consequences:** filming R4's Done-when needs a key-backed run (KI-R15). R5 draws the wound closing on the same `woundPoints`.

### D-R20: The heal loop (R5) · amended by D-R21 (Reanimator now drives Kiro from the grimoire)
- **Context:** R5's grill (2026-11-05), run with the recommended answers.
- **Decision:**
  - **Reanimator doesn't drive Kiro.** Kiro has no stable headless API, and its tokens are kept for the demo. Each wound gets a **heal brief** (`shared/heal.ts`) in plain QA words, with no theme words (like Poltergeist D-09). It gives the criterion, the persona, the steps, the expected and failing checks, a pointer to `.kiro/specs/chart/haunting-report.md`, and "don't edit the chart". The panel shows **Copy for Kiro** and the revived repo's path to open in Kiro. Wiring Kiro in (MCP, `init`, the agent surface) is R7's.
  - **Re-raise before every attack but the first** on a ritual, and whenever the app is down. The served app doesn't reload edits, so `Rituals.reraise` stops it and runs the four real vitals on the same revived dir. They stream as `pulse` events, then `reraised {origin}`. If a vital fails, the attack ends `failed: the heal broke the body: <vital>: <first line>` and the app stays down. The body (`Rituals.body`) stays, so the next Dare raises it again. **It always rises on its first port.** Poltergeist only carries an earlier report's rows for the same `target` (its `usableRow`), so a new origin would silently drop every other wound from the ledger (found in review). If the port was taken meanwhile, serve fails honestly.
  - **A heal re-runs one wound:** `POST /api/rituals/:id/attack {heal:{criterion,persona}}` → `summon --only <criterion> --personas <persona>`, same reps. A malformed heal is a 400. A heal for a wound that isn't open fails in-stream (`that wound is not open`) without running the engine; the grill said 409, but whether it's open is only known after reading the report.
  - **The merged report is the ledger** (Poltergeist F14). Open wounds are its haunted pairs, carried ones included (`carried: true`; they reproduced then). `summoned` carries the wounds open before the run (read from the existing report) and the revived dir (`body`), so a reload keeps both.
  - **A wound closes only on a genuine pass (D-R11):** its pair is in this run's report (`runId`), not carried, with verdict `clean`. `finished.heal.verdict` is that verdict, or `notRun` for a carried or missing pair. `Attacks` remembers the ritual's healed wounds (`finished.healed`), and a later attack that breaks one again reopens it. A heal that comes back flaky or inconclusive replaces the haunted pair in the report but proves nothing. `Attacks` keeps that wound open (*unproven*, still listed and dareable) until a later run of its pair comes back clean (healed) or haunted.
  - **The look:** healed lines turn `--magic` ("The wound closed: Death could not break 1.2 again."). A haunted result reads "Death broke it again." and anything else "Not proven healed (<verdict>)". In the scene, the healed wound's gash dissolves cell by cell over 1.2 s in a fixed order; with reduced motion it's simply gone. The `--magic` seal glow (THEME §6) is not drawn yet (KI-R19).
- **Consequences:** R5's Done-when needs a real Kiro fix plus a key-backed re-run (KI-R19, KI-R15). Every re-attack pays for an `npm install` on the body. The heal lives only in the ritual's temp dir (KI-R19).

### D-R21: The grimoire drives Kiro (R7)
- **Context:** R7's grill (2026-11-05), run with the recommended answers. D-R20 said Reanimator doesn't drive Kiro because Kiro had no stable headless API. `kiro-cli` 2.37 now has one: `chat --no-interactive --output-format stream-json` prints the run's ACP events as JSON Lines. This amends that one bullet of D-R20; the rest of D-R20 stands.
- **Decision:**
  - **A spell is one Kiro turn:** `kiro-cli chat --no-interactive --output-format stream-json --trust-tools=fs_read,fs_write [--resume] -- <text>`, run in the ritual's revived dir (`server/kiro.ts`). Later spells on the same ritual add `--resume`, which continues that directory's latest conversation. The spell goes after `--`, so it's never read as a flag. Its binary is `REANIMATOR_KIRO`, or `kiro-cli` by default.
  - **What Kiro may do:** read and write files in the body, and nothing else (no shell tool). Its env is `kiroEnv`: `childEnv` plus `XDG_*`, so it finds its own login. It never gets `ANTHROPIC_*`, `AWS_*` or `DOPPLER_*`.
  - **The protocol:** `POST /api/rituals/:id/spells {text, heal?}` → 202 `{id}`. Text is 1–20 000 characters, otherwise 400. It's 409 if the ritual hasn't risen, Death is attacking, or a spell is already being cast (with its id). Then `GET /api/spells/:id/events` (resumable SSE, like the attack) and `POST /api/spells/:id/stop`. A spell is `cast`, then `quill` / `margin` / `ruled` / `candle` events, then `sealed {stopReason}` or `failed {reason}` (`shared/grimoire.ts`). A spell times out after 10 min. A new ritual or shutdown breaks it off first (`onRelease`).
  - **Kiro and Death never share the body:** a spell is refused while Death attacks, and Death is refused while a spell is being cast (`Kiro is still casting; wait for the seal`).
  - **The page (THEME §8), all real DOM text:** a spell is a `†` line in magic. Kiro's reply is quill writing, revealed two letters a frame, or all at once with reduced motion. Each tool call is a margin note (its title and status). A diff is a ruled box with − lines in death and + lines in rot. A turn that ended is a wax seal ("Sealed (end_turn).").
  - **The candle burns only from a real number** (D-R11): an ACP `usage_update {used, size}`. Without one it reads "the candle is unlit: Kiro reported no context".
  - **The stream is read leniently**, because its live envelope is unverified (KI-R21): the update is at `params.update`, at `update`, or is the line itself. Thoughts, plans and unknown lines are ignored.
  - **The heal stays the user's to prove:** each wound has **Cast in the grimoire**, which pre-fills the spell with its heal brief (still plain QA words). A heal spell that ends its turn (`end_turn`) offers **Dare Death again** on that wound, but never dares by itself: every dare costs an LLM key's tokens and re-raises the body. **Copy for Kiro** stays as the fallback.
  - **From the review (fixed before merge):**
    - A body Kiro has edited is raised again even before the ritual's first attack (`Grimoire.edited` → `Attacks`). The running app never reloads edits, so Death would otherwise attack the pre-spell code.
    - `--resume` is used only once a turn has reached Kiro (it sent an event or ended cleanly). A first spell that failed to start doesn't poison the next one.
    - A tool call's diffs are one ruled box, keyed by its `toolCallId` and redrawn in place when the call sends them again.
    - A clean exit with no stop reason seals as `exited`, never as an `end_turn` that Kiro didn't send. Either one offers the dare.
  - **No Poltergeist `init`/MCP in the body:** Reanimator stays the only caller of Death, so there's one ledger (D-R20).
- **Consequences:** R7 is built and tested against a fake `kiro-cli` (`server/fixtures/fake-kiro.mjs`), with no Kiro tokens spent. The live cast and R7's Done-when wait on the batched Kiro session (KI-R21). The grimoire lives in the page's memory: a reload starts a blank book, though Kiro's own conversation resumes.

### D-R22: The hosted replay is a recording of Reanimator's own streams (R11)
- **Context:** R11's grill (2026-11-05), run with the recommended answers. A judge must see the run without installing anything. Hosting the live raise and attack needs a sandbox, Node, Chromium and an LLM key on a public box (KI-R7). Poltergeist's F15 export (D-43) records only the engine, not the raise, the heal or the grimoire.
- **Decision:**
  - **A static replay of a real run, not a hosted live instance.** Live stays a bonus.
  - **The backend records what it streams.** With `REANIMATOR_RECORD=<dir>`, `server/recorder.ts` copies every ritual, attack and spell event the backend sends (the SSE logs), each stamped with ms since recording began, plus every engine frame the attack streamed. Recording the hero run means using the app normally, including the human heal. The recorder is off by default. It refuses a folder that already holds a recording, and it never deletes.
  - **The bundle:**
    - `recording.json`: `{format: 'reanimator-recording', version: 1, recordedAt}`.
    - `events.ndjson`: lines of `{t, stream: ritual|attack|spell, id, event}` (`shared/recording.ts`).
    - `frames/<attackId>/<ghostId>/<seq>.jpg`.

    Frames stop being kept past 50 MB (with one warning). The home dir is replaced by `~` in every line.
  - **The replay is the real UI.** `RaiseScene` is split into a pure `RaiseView` fed by handles. Live, the handles are the three hooks. In a replay they come from `src/replay/` folding the lines with the **same shared reducers** (`step`, using the hooks' rules: a new ritual starts afresh, a new attack starts from QUIET, spells share one book). Frames come through `FrameUrlContext`.
  - **Honest by construction (D-R11):**
    - A permanent banner reads "RECORDED RUN · replay of a real run on <date> · nothing here is live · pauses longer than 2 s are shortened".
    - Every control sits in one disabled `<fieldset>`.
    - The revived app's iframe is replaced by "The revived app ran at <origin> on the recording machine."
    - With no recording published, the page says "No recording yet" and plays nothing.
    - The synthetic test session lives in `src/replay/fixtures/` and is never published.
  - **The clock:** real gaps, each capped at 2 s (`MAX_GAP_MS`). Play/pause, 1×/2×/4× and restart; no scrubbing. With reduced motion it waits for Play.
  - **Hosting:**
    - `vite base: './'`, and art goes through `art()` (`import.meta.env.BASE_URL`).
    - `npm run build:replay` (`--mode replay`, `.env.replay`: `VITE_REPLAY=1`) opens on the replay. Locally it's `?replay`.
    - `.github/workflows/reanimator-pages.yml` deploys `dist/` to GitHub Pages, **by hand only** (`workflow_dispatch`). Nothing is published until someone enables Pages and runs it.
  - **Poltergeist's F15 export isn't used:** the Reanimator recording already carries the engine events and frames the UI showed.
- **Consequences:** R11 is built, but the hosted page shows "No recording yet" until the real hero run is recorded and committed to `public/recording/` (KI-R23, blocked on KI-R1, KI-R15 and the Kiro session). A recording is a snapshot: it shows what the UI showed then, not a re-run.

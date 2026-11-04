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

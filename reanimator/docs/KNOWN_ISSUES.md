# Reanimator: Known Issues

> Open risks and unknowns for the Reanimator app. IDs are `KI-Rxx` to avoid clashing with Poltergeist's `KI-xx`.
> **Severity:** `Blocker` · `Major` · `Minor`. **Status:** `Open` · `Investigating` · `Resolved` · `Accepted`. Don't delete entries.

| ID | Issue | Severity | Blocks | Status |
|---|---|---|---|---|
| KI-R1 | We haven't chosen the one demo repo (must be small, permissively licensed, genuinely dead on Node 22, quick to revive) | Blocker | R2, demo | Open |
| KI-R2 | Art quality: the original author left, the teammate is vibe-coding, and we can't copy the prototype | Major | R4, costume | Investigating |
| KI-R3 | Dot-matrix render performance (many dots, live frames) | Minor | R4 | Investigating |
| KI-R4 | How exactly Reanimator calls Poltergeist (CLI vs MCP; monorepo wiring) | Major | R3 | Open |
| KI-R5 | The revived app needs a spec ("chart") for Poltergeist to test against | Major | R3 | Open |
| KI-R6 | Eligibility: the idea was prototyped before the window; present the rebuild honestly | Major | submission | Open |
| KI-R7 | Running revive + attack live for a judge may be too heavy; may need a recorded replay | Major | R11 | Open |
| KI-R8 | Reviving arbitrary cloned repos runs untrusted code | Major | R9 | Open (deferred to R9) |
| KI-R9 | Scene scope: four scenes is a lot for a vibe-coder; which are essential | Minor | R4, R6, R7 | Open |
| KI-R10 | `npm audit`: moderate `minimatch` advisory in the ESLint dev chain | Minor | none (dev-only) | Accepted |
| KI-R11 | Canvas sizing: CSS `100vw/100vh` vs `innerWidth/innerHeight`, and a DPR-only change isn't redrawn | Minor | R1 | Resolved |
| KI-R12 | The backend has no Origin/Host check yet; needed once routes run commands | Major | R2, R3 | Open |

---

### KI-R1: Choose the demo repo · Blocker · Open
- **Why it matters:** the whole demo hangs on one repo that reliably goes dead → revived → attacked → healed.
- **What it needs to be:** small; an OSI licence; genuinely fails to install/build/run on Node 22 (e.g. a ~2014–2017 jQuery/Backbone/AngularJS app with Bower/Grunt/Gulp 3/node-sass); quick to revive; and with at least one real, demoable flaw Death can find (a form with no validation, a naive action with a race).
- **Next action:** shortlist 3 candidates, revive each by hand once, pick the most reliable and the most demoable. Keep its before/after in `fixtures/`.

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

### KI-R5: The revived app needs a chart · Major · Open
- **Problem:** Poltergeist tests against a spec (`requirements.md`). The revived repo won't have one.
- **Plan (D-R8):** hand-write a small chart for the demo repo for v1; later an agent can generate it (the original Reanimator's "Archivist" idea).
- **Next action:** write the demo repo's chart as part of R3.

### KI-R6: Eligibility of a prototyped idea · Major · Open
- **Context:** both earlier projects predate the window; this repo doesn't. Code is all fresh (D-R2).
- **Plan:** keep the earlier projects private and unlinked; don't port code; in the write-up, say plainly the idea was prototyped before the event and rebuilt from scratch during it. Confirm the 2026 "new project" wording (Poltergeist KI-05).
- **Next action:** read the 2026 rules.

### KI-R7: Live demo may be too heavy · Major · Open
- **Problem:** revive + serve + attack live, in front of a judge, is a lot.
- **Plan:** record a real run as the primary artifact (R11), like Poltergeist's F15; offer live as a bonus.
- **Next action:** decide during R11.

### KI-R8: Reviving arbitrary repos runs untrusted code · Major · Open (deferred to R9)
- **Problem:** cloning and `npm install`-ing a stranger's repo executes their scripts.
- **Plan:** v1 avoids this by using one prepared repo (D-R6). For R9, sandbox (container or locked-down runner) before going general.
- **Next action:** only when R9 is attempted.

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

### KI-R12: Backend request origin checks · Major · Open
- **Problem (R0 review):** the backend binds 127.0.0.1 only (D-R12), but a web page in the user's browser could still send requests to it (CSRF / DNS rebinding). Harmless with only `/api/health`; not harmless once R2/R3 add routes that install, build or attack.
- **Next action:** R2's plan adds Host/Origin validation (allow only the Vite origin and loopback hosts), with tests, before any command-running route.

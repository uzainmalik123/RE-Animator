# Reanimator: Product Requirements (PRD)

> Last updated: 2026-11-01 · Target: Kiroween 2026, **Frankenstein** category (a mash-up of two systems). Costume is a strong secondary angle.
> Story: [STORY.md](STORY.md) · Art: [THEME.md](THEME.md) · Decisions: [DECISIONS.md](DECISIONS.md) · Issues: [KNOWN_ISSUES.md](KNOWN_ISSUES.md) · Stack: [STACK.md](STACK.md) · Spec: [`.kiro/specs/reanimator/`](../.kiro/specs/reanimator/requirements.md)
> **Who builds this:** the teammate, vibe-coding with an agent. The agent should hold their hand (see [AGENTS.md](../AGENTS.md)). Every feature below is written to be buildable with agent help.

## How to use this doc

- **Status:** `TBD` · `Done` (built _and_ its "Done when" passes) · `Scrapped` (with the reason kept).
- **Priority:** `High` = no demo without it. `Med` = makes it competitive. `Low` = only if time allows.
- **Build order:** follow the order column. Get the **vertical slice** (R0→R5) working end to end on ONE prepared repo before widening.
- **Scopes don't overlap.** Each feature has an **Owns** line.
- IDs are `R0…R11` to avoid clashing with Poltergeist's `F…` ids.
- **🔒 Built in Kiro (D-R18):** R6, R8 and R10 are built in Kiro, spec-first, in the batched Kiro session near the demo. They are the last features, and **Claude Code must not grill, plan, implement or review them** (no code, no spec files). Nothing built in Claude Code may depend on them.

## The mash-up in one picture

```
  Reanimator (this app, the necromancer's world, all the UI + art)
  ┌───────────────────────────────────────────────────────────────┐
  │  graveyard → RAISE a dead repo → it runs → DEATH attacks it →  │
  │              findings (wounds) → HEAL with Kiro → re-attack     │
  └───────────────────────────────┬───────────────────────────────┘
                                   │ Death's attack =
                                   ▼
                 Poltergeist engine  (../poltergeist, already built, headless)
                 reads a spec of the revived app, runs persona attacks,
                 returns haunting-report.json  → Reanimator draws it as wounds
```

**Division of labour:** Reanimator owns the story, the art and the flow. Poltergeist owns the attack engine (done). Reanimator *calls* Poltergeist; it never re-implements the attacks.

## Status board

| Order | ID | Feature | Priority | Status |
|---|---|---|---|---|
| 0 | R0 | Scaffold (Vite + React + TS, canvas, health gate, CI) | High | Done |
| 1 | R1 | Dot-matrix renderer (the art engine) | High | Done |
| 2 | R2 | The Raise: revive one prepared dead repo, prove it with vitals | High | Built (practice corpse); demo repo pending KI-R1 |
| 3 | R3 | Death's attack: wire in the Poltergeist engine | High | Built; live run pending KI-R15 |
| 4 | R4 | The attack scene: draw Death + minions over the running app | High | Built; filming pending KI-R15 |
| 5 | R5 | Wounds + heal loop: show findings, fix with Kiro, re-attack | High | Built; Kiro heal pending KI-R19 |
| 6 | R7 | The grimoire: the agent/chat surface | Med | Built; live Kiro cast pending KI-R21 |
| 7 | R11 | Hosted demo / replay | Med | Built (recording owed, KI-R23) |
| 8 | R9 | Arbitrary GitHub URL + real clone & revive | Low | Built (live run owed, KI-R25) |
| 9 | R6 | 🔒 **Built in Kiro.** The graveyard: pick a dead repo | Med | Built (D-R24) |
| 10 | R8 | 🔒 **Built in Kiro.** Autopsy: why it died | Med | TBD (Kiro only, D-R18) |
| 11 | R10 | 🔒 **Built in Kiro.** Sound & atmosphere | Low | TBD (Kiro only, D-R18) |

**Minimum demo-able product = R0–R5** (the vertical slice on one repo) **+ enough of R1/R4 to look like the art.**

## Time budget (Nov 1 – Dec 4, deadline unconfirmed, see Poltergeist KI-05)

| Week | Goal |
|---|---|
| 1 (Nov 1–7) | R0, R1 (renderer working on one image), pick + prepare the one demo repo (R2 groundwork) |
| 2 (Nov 8–14) | R2 (the raise + vitals), R3 (Poltergeist wired, findings coming back) |
| 3 (Nov 15–21) | R4 (attack scene), R5 (wounds + heal loop). **Vertical slice works** |
| 4 (Nov 22–28) | R7, R11 as time allows; polish the art. **Batched Kiro session:** R6, R8, R10 + Candy Swap + the heal demo (D-R18) |
| 5 (Nov 29 – Dec 4) | Freeze on Dec 1. Record the video, write-up, submit |

---

## HIGH

### R0: Scaffold · High · Done
**Owns:** the app skeleton: Vite + React + TypeScript, a `<canvas>` test page, ESLint, a test runner, `npm run health` (typecheck + lint + test), `.github/workflows` CI, and a backend entry (a small Node/Express or Hono server) for running revive/attack commands.
**Not this feature:** any scene or art.
- **User story:** As the builder, I want one command that says the app is healthy, from day one.
- **Constraints:** TypeScript. Pin versions. Mirror Poltergeist's health-gate discipline (see the sibling's AGENTS.md).
- **Done when:** `npm run dev` serves a blank canvas page, and `npm run health` is green locally and in CI.

### R1: Dot-matrix renderer · High · Done
**Owns:** the reusable renderer that turns an image (or a live frame) into dithered dots/glyphs on a canvas, per [THEME.md](THEME.md) §3: Bayer dither, brightness steps, empty-darkest, `pitch`, palette tokens.
**Not this feature:** the scenes that use it (R2, R4).
- **User story:** As every later scene, I need one renderer so the whole app shares the look.
- **User flow:** `drawDots(ctx, image, { pitch, palette })` and a glyph variant `drawGlyphs(...)`.
- **Constraints:** deterministic (same input → same dots). 30fps on an animated frame. Honour `prefers-reduced-motion`.
- **Done when:** a demo page renders a sample image as purple-on-void dots, a snapshot test pins the output, and switching `pitch` changes density. Put a picture of it in front of the team to approve the look.
- **Built (2026-11-04, D-R13):** `src/render/` (`dither.ts` pure core, `draw.ts` painters, `renderer.ts` `DotRenderer`, `viewport.ts`). The demo is `npm run dev`. Screenshots: `docs/img/r1-renderer-{dots,glyphs}.png`. The team's look approval is still open on KI-R2.

### R2: The Raise · High · Built (practice corpse); demo repo pending KI-R1
**Owns:** reviving **one prepared dead repo** (bundled in `fixtures/`), and proving it with deterministic **vitals** (install, build, serve, render), plus the raise scene (spell circle + heart monitor flatline → pulse). The backend runs the commands in a temp dir and streams status to the UI.
**Not this feature:** Death (R3/R4) · picking the repo (R6) · arbitrary URLs (R9).
- **User story:** As the necromancer, I raise a dead project and watch its heart start beating, for real.
- **User flow:**
  1. The one demo repo starts "dead" (fails to install/build/run on Node 22).
  2. The user starts the ritual.
  3. The backend applies the prepared fix (or runs an agent step) and runs vitals; the UI shows flatline → pulse as each vital passes.
  4. The revived app is served at a localhost origin and shown running.
- **Constraints:**
  - **Pick a small, permissively licensed demo repo** that genuinely fails on Node 22 and is quick to fix (KI-R1). Keep its "before" and "after" so the demo is reliable.
  - Vitals are real checks, not animations faked on a timer (STORY § Tone).
  - The revived app must end up served at a URL Poltergeist can point at (R3 needs this).
- **Done when:** on the demo machine, the demo repo goes from failing to served-and-rendering, and the pulse scene reflects the real vital results.
- **Built (2026-11-04, D-R14, D-R15):** `shared/ritual.ts` (protocol + reducer), `server/{exec,fixtures,vitals,render-check,ritual,guard}.ts`, `POST /api/rituals` + SSE events, and the raise scene in `src/raise/`. Proven end to end on `fixtures/practice-corpse` (a real `EBADENGINE` flatline → 4 real vitals → the guestbook served on 127.0.0.1 and shown; `server/ritual.integration.test.ts`). Screenshots: `docs/img/r2-raise-{idle,risen}.png`. The real demo repo's run waits on KI-R1.

### R3: Death's attack (wire in Poltergeist) · High · Built; live run pending KI-R15
**Owns:** calling the Poltergeist engine against the revived app and getting findings back: write a `poltergeist.config.json` pointing at the revived app's origin, provide/author a spec (the "chart") of the revived app, run Poltergeist (its CLI `summon` or MCP), and parse `haunting-report.json`.
**Not this feature:** drawing the attack (R4) · the engine itself (that's the sibling, already built).
- **User story:** As Death, I fall on the revived app and try to break it; whatever I break comes back as a list.
- **User flow:**
  1. Reanimator has a small Kiro spec describing what the revived app should do (the "chart"). For v1, hand-write it for the demo repo.
  2. Reanimator writes a Poltergeist config aimed at the revived app's origin (localhost only — Poltergeist refuses anything else).
  3. Reanimator runs Poltergeist; it compiles persona tests, runs them, and writes the report.
  4. Reanimator reads `haunting-report.json`: the haunted/clean criteria, the persona, the steps, the evidence.
- **Constraints:**
  - **Don't re-implement the attacks.** Shell out to the sibling engine or use its MCP. Read `../poltergeist/README.md` and its `docs/`.
  - Poltergeist only attacks localhost by design, so the revived app must be local. Good — it is (R2).
  - Each persona = one class of adversarial test (input-injection-style, race, impatient resubmit, stale session, slow device, keyboard-only), using the engine's existing safe mechanisms (vetted static inputs + generators; the model never writes payloads). This is QA/robustness testing of the app **you revived and own** — not an exploit tool (see Poltergeist D-08).
- **Done when:** running the full loop on the demo repo produces a real `haunting-report.json` with at least one reproduced finding.
- **Built (2026-11-04, D-R16, D-R17):** `server/{env,event-log,sse,chart,engine,report,attack}.ts`, `shared/attack.ts`, `POST /api/rituals/:id/attack` + `GET /api/attacks/:id/events` (SSE), the practice corpse's chart (`fixtures/practice-corpse/chart/`) and a real-text **Summon Death** panel (`src/attack/`). The real Poltergeist CLI runs end to end in CI against the risen guestbook with no key: Scout walks it, the chart parses, and the run stops at the compiler (`server/attack.integration.test.ts`). The Done-when itself needs a key: `doppler run -- npm run attack:check` (KI-R15), then again on the real demo repo (KI-R1).

### R4: The attack scene · High · Built; filming pending KI-R15
**Owns:** the scene where Death and his six minions attack the running app: the app rendered as dots, minion sprites (`--death`) swarming it, and a wound opening where a finding lands (THEME §5–6).
**Not this feature:** getting the findings (R3) · the heal loop (R5).
- **User story:** As a viewer, I want to *see* Death break the app, so the demo is memorable.
- **User flow:** as Poltergeist streams progress (or when the report lands), minions appear over the app; each finding draws a red wound at its spot with a short label.
- **Constraints:**
  - Uses the R1 renderer.
  - Red (`--death`) only for Death and wounds; never purple.
  - If live streaming from the engine is hard, drive the scene from the finished report (still real data).
- **Done when:** a real run on the demo repo plays as an attack with at least one visible wound, good enough to film.
- **Built (2026-11-05, D-R19, plan `docs/plans/2026-11-05-R4-attack-scene.md`):** the live tail now carries ghosts, their real positions and frame marks (`shared/attack.ts`, `server/engine.ts`); `GET /api/attacks/:id/frames/:ghostId/:seq` serves the engine's own frames; `src/attack/scene.ts` (pure layout and luminance) and `AttackScene.tsx` draw the body in bone and Death, minions and wounds in red, with wound labels as real text. Seen in the browser with no key: Death arrives, then falters (`docs/img/r4-attack-arrival.png`). The filmed Done-when needs a key-backed run (KI-R15), then the demo repo (KI-R1).

### R5: Wounds + heal loop · High · Built; Kiro heal pending KI-R19
**Owns:** the findings list ("wounds on the chart"), triggering a Kiro fix for a finding, re-running Poltergeist on just that finding, and showing the wound close.
**Not this feature:** the attack visuals (R4) · the engine (sibling).
- **User story:** As the necromancer, I heal what Death broke and dare him to try again.
- **User flow:**
  1. Each finding is a wound with its reproduction steps.
  2. The user sends it to Kiro to fix (Kiro edits the revived repo).
  3. Reanimator re-runs Poltergeist on that finding (`--only <id>`).
  4. If it's now clean, the wound closes (THEME §6) and the chart line turns from red to healed.
- **Constraints:**
  - The re-run is real (Poltergeist's `rehaunt` / `--only`).
  - A wound only closes on a genuine pass.
- **Done when:** in the demo, one finding goes wound → healed after a real fix and re-run.
- **Built (2026-11-05, D-R20, plan `docs/plans/2026-11-05-R5-heal.md`):**
  - Each wound has a **Copy for Kiro** brief (`shared/heal.ts`) and **Dare Death again**, which posts `{heal}`.
  - The backend re-raises the body on the four real vitals (`Rituals.reraise`, streamed as pulses), then runs `summon --only <criterion> --personas <persona>`.
  - The wound closes only if that pair ran clean in this run. The merged report is the ledger.
  - Healed lines turn magic, and the gash dissolves in the scene.
  - A real re-raise serving an edited body is tested. The Done-when needs Kiro and a key (KI-R19, KI-R15).

---

## MED

### R7: The grimoire (agent surface) · Med · Built; live Kiro cast pending KI-R21
**Owns:** the spellbook-styled surface for talking to Kiro (THEME §8): prompts as spells, replies as quill writing, tool runs as margin notes, code changes as ruled boxes, context as a candle.
- **User story:** As the necromancer, I direct my familiar through the grimoire, not a chat box.
- **Constraints:** the text stays real text (not dots). Wire it to the actual agent used for healing (R5).
- **Done when:** a heal (R5) can be driven from the grimoire and reads like casting a spell.
- **Built (2026-11-05, D-R21, plan `docs/plans/2026-11-05-R7-grimoire.md`):**
  - Each spell is one headless `kiro-cli chat` turn in the revived body, with file tools only. Its ACP stream comes back as SSE (`server/kiro.ts`, `server/grimoire.ts`, `shared/grimoire.ts`).
  - The grimoire panel (`src/grimoire/`) shows the spell, the quill reply, margin notes, ruled-box diffs, a candle (only from a real usage report) and the wax seal.
  - Each wound's **Cast in the grimoire** pre-fills its heal brief. A sealed heal offers **Dare Death again** on that wound.
  - Kiro and Death never run on the body at once.
  - It was seen in the browser with a fake Kiro (`docs/img/r7-grimoire.png`). The live cast and the Done-when wait on the Kiro session (KI-R21).

### R11: Hosted demo / replay · Med · Built (recording owed, KI-R23)
**Owns:** a way for a judge to see it without installing: a recorded replay of a real run, or a hosted instance.
- **User story:** As a judge, I want to open a URL and see it work.
- **Constraints:** if hosting the live revive+attack is too heavy, ship a recorded replay (clearly labelled), like Poltergeist's F15.
- **Done when:** a public URL shows the hero run end to end.
- **Built (2026-11-05, D-R22):**
  - With `REANIMATOR_RECORD=<dir>`, the backend records its own event streams and frames (`server/recorder.ts`).
  - `?replay` (or the `npm run build:replay` site) plays them in the real UI. It uses the same reducers, a permanent "RECORDED RUN" banner, locked controls and gaps capped at 2 s (`src/replay/`).
  - A hand-run workflow deploys to GitHub Pages.
  - The real hero recording is KI-R23.

---

## LOW

### R9: Arbitrary GitHub URL + real clone & revive · Low · Built (live run owed, KI-R25)
**Owns:** accepting any dead-JS-repo URL, cloning it, and attempting a real revive (not just the prepared one).
- **Constraints:** sandbox the clone and the install (untrusted code). This is the hardest part of the original Reanimator; treat as a stretch goal.
- **Done when:** at least one *unprepared* permissively licensed repo revives end to end.
- **Built (2026-11-05, D-R23):** a "Name a grave" field; `server/grave.ts` (URL check, shallow clone, headstone), `server/sandbox.ts` (bubblewrap), `server/rites.ts` (four fixed Node 22 cures, named in the ritual), `server/serve.ts` + `static-serve.mjs` (serving an unknown body). Proven on a local git repo in the real sandbox (`server/grave.integration.test.ts`). A real GitHub repo is KI-R25. Death refuses a grave with no chart, and Kiro won't cast on one (review fix). Screenshot: `docs/img/r9-grave-field.png`.

---

## 🔒 BUILT IN KIRO (last, D-R18)

These are built **in Kiro, not Claude Code**, so the entry really uses Kiro's spec workflow on the product itself. In the batched Kiro session: open `reanimator/` in Kiro, create a spec for the feature (Kiro writes `requirements.md`, `design.md` and `tasks.md`), let Kiro implement the tasks, run `npm run health`, and commit Kiro's output as it is. **Claude Code sessions must not grill, plan, implement or review these.** If asked to, stop and remind the user (D-R18). Their scopes stay as below.

### R6: The graveyard (pick a repo) · Med · Built (D-R24) · 🔒 Kiro only
**Owns:** the opening scene: a graveyard of dead repos to choose from (a curated list in v1), Kiro walking out to fetch the chosen one.
- **User story:** As the necromancer, I choose which dead project to raise.
- **Constraints:** curated list of prepared repos in v1; no live GitHub search yet (that's R9).
- **Done when:** the user picks from the graveyard and it leads into the raise (R2).

### R8: Autopsy (why it died) · Med · TBD · 🔒 Kiro only
**Owns:** showing *why* the repo was dead (the causes: a rotted dependency, a dead build tool), shown as the necromancer reading the body.
- **User story:** As a developer, I want to know what killed it and what was changed.
- **Constraints:** can be pre-written for the demo repo in v1, or generated by an agent step.
- **Done when:** the demo shows a believable cause of death tied to the real fix.

### R10: Sound & atmosphere · Low · TBD · 🔒 Kiro only
**Owns:** heartbeat, the cast, Death's arrival; idle fog drift; all off by default (THEME §9).
- **Done when:** the video has sound and the scenes have subtle motion, with a mute toggle.

---

## SCRAPPED / explicitly out of scope for v1

- **Full Docker "operating room" per revive** (the original Reanimator's isolation model): too heavy for a vibe-coded build. Use a temp-dir sandbox for the prepared repo; revisit for R9.
- **Framework migrations** (AngularJS→Angular etc.): never. Revive faithfully, like the original.
- **Auto-opening PRs on third-party repos:** never. Produce a branch/patch/PR text for a human (STORY close).
- **Turning Poltergeist into an exploit/security-attack generator:** no. It stays QA/robustness testing of your own revived app (Poltergeist D-08).

## Changelog
- 2026-11-01: PRD created for the merged entry. Reanimator is the product; Poltergeist is its red-team engine (Death). Frankenstein category.
- 2026-11-02: R0 Done. Vite + React canvas page, Hono backend (`/api/health`, 127.0.0.1:7070), `npm run health` green, CI `reanimator-ci.yml` (D-R12, plan `docs/plans/2026-11-02-R0-scaffold.md`).
- 2026-11-04: R1 Done. Dot-matrix renderer in `src/render/` (Bayer 4x4, empty-darkest, dots and glyphs, a per-cell cached `DotRenderer`, ~3 ms/frame at 1080p) and a demo page on our own SVG sample art. Fixes KI-R11 (D-R13, plan `docs/plans/2026-11-04-R1-renderer.md`). Look approval stays open on KI-R2.
- 2026-11-04: R2 Built on a practice corpse (D-R14, D-R15, plan `docs/plans/2026-11-04-R2-raise.md`): the repo-agnostic ritual (real flatline, remedy, 4 vitals incl. headless-Chromium render), SSE with resume, one ritual at a time, and the raise scene (spell circle + heart monitor). Resolves KI-R12 (loopback guard). The demo repo itself is still KI-R1.
- 2026-11-04: R3 Built (D-R16, D-R17, plan `docs/plans/2026-11-04-R3-death.md`): Death is the Poltergeist CLI run as a subprocess against the risen origin, from the fixture's chart; progress tailed from its `events.ndjson`, wounds read from `haunting-report.json` (haunted pairs only), over SSE to a real-text panel. Resolves KI-R4, KI-R5; fixes KI-R14 #2 and #4. The live run with a key is KI-R15.
- 2026-11-04: R6 (graveyard), R8 (autopsy) and R10 (sound) are reserved for **Kiro** and moved to the end of the build order (D-R18). Claude Code sessions don't build them.
- 2026-11-05: R4 Built (D-R19, plan `docs/plans/2026-11-05-R4-attack-scene.md`): the attack scene replaces the raise stage on Summon Death. The body is the engine's own frames, minions sit at the ghosts' real step positions, and wounds open where a haunted pair's ghost acted. Filming waits on KI-R15. Adds KI-R17.
- 2026-11-05: R5 Built (D-R20, plan `docs/plans/2026-11-05-R5-heal.md`): heal briefs for Kiro, Dare Death again (re-raise on real vitals + a one-wound re-run), the merged report as ledger, and a wound closes only on a clean pair that really ran; healed lines in magic and a dissolving gash. The Done-when waits on Kiro + a key (KI-R19, KI-R15).
- 2026-11-05: R7 Built (D-R21, plan `docs/plans/2026-11-05-R7-grimoire.md`): the grimoire drives the real Kiro agent through `kiro-cli chat --output-format stream-json` (one turn per spell, fs tools only, never during Death), drawn as spell, quill, margin notes, ruled boxes, candle and seal. A wound can be cast from its brief, and a sealed heal dares Death again. Tested against a fake kiro-cli. The live cast is KI-R21.
- 2026-11-05: R11 Built (D-R22, plan `docs/plans/2026-11-05-R11-replay.md`). The backend records a session (`REANIMATOR_RECORD`), and the real UI replays it from static files with a "RECORDED RUN" banner and locked controls. `npm run build:replay` plus a hand-run GitHub Pages workflow host it. Resolves KI-R7. The hero recording is KI-R23.
- 2026-11-05: R9 Built (D-R23, plan `docs/plans/2026-11-05-R9-any-grave.md`). Name a GitHub grave; it's cloned shallow, proven dead and raised inside a bubblewrap sandbox, with four fixed rites as its remedy. Resolves KI-R8. The live run on a real repo is KI-R25; the sandbox's limits are KI-R26.
- 2026-11-07: R6 Built in Kiro (D-R24, spec `.kiro/specs/r6-graveyard/`, plan `docs/plans/2026-11-07-R6-graveyard.md`). The app opens on a graveyard of three prepared graves (each dies at a different vital); Kiro walks to the chosen stone, then the raise takes over; "Back to the graveyard" returns.

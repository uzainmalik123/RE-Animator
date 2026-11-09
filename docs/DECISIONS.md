# Decisions

| ID | Decision | Status |
|---|---|---|
| D-01 | Pivot: Reanimator and Poltergeist are scrapped; the entry is a horror cyber incident-response game (docs/GAME_PLAN.md) | Accepted |
| D-02 | Fresh start: main keeps only the game skeleton, the secrets guard and repo basics; everything else lives on the `failed` branch | Accepted |
| D-03 | Platform: a hosted web page plus one small Kiro server; desktop only; no accounts or saves; ~10–12 min runs | Accepted |
| D-04 | Kiro is real (`kiro-cli acp`) but on rails: rules decide what it may do, Kiro talks and drafts; its latency is part of the game; rule-written fallback; credit caps | Accepted |
| D-05 | Our own shell with a fixed real command set, not real bash; Kiro is told the set and its drafts are parsed against it | Accepted |
| D-06 | Post-incident report: rules compute every fact and grade; Kiro writes the debrief around them | Accepted |
| D-07 | Recordings: Juice Shop behind nginx on an isolated network; capture logs, DB and file changes per move variant | Accepted |
| D-08 | Meters: souls never come back; heartbeat drains while Death uses an open door, while minions run, and for self-inflicted downtime, and recovers once the cause is gone | Accepted |
| D-09 | Minions are real background attackers that do damage and must be closed, but each is closed by one correct action | Accepted |
| D-10 | Scope: deadline 2026-12-04, team of two; PRD ranks rows must / should / stretch; 15–20 Death moves and player actions | Accepted |
| D-11 | Death never uses an LLM: taunts are pre-written | Accepted |
| D-12 | `docs/PRD.md` is the source of truth; changes go into the PRD and DECISIONS before code | Accepted |

### D-01: Pivot to an incident-response game
- **Context:** (2026-11-08) Reanimator raised dead repos so Death could attack them. Any agent can revive a repo on its own, so the product added nothing, and the UI had drifted into a pile of screens with no vision.
- **Decision:** the entry becomes a horror-themed incident-response simulator: a timed briefing, then Death attacks with real recorded attacks while the player defends with real actions; Death is driven by a rules-based Director; souls (data) and heartbeat (business) meters; three difficulty levels as dials on one scenario. Details and open questions are in `docs/GAME_PLAN.md`.
- **Consequences:** Poltergeist's engine isn't used. Kiro tokens are still saved for the demo.

### D-02: Fresh start on main
- **Context:** (2026-11-08) The old code is kept whole on the `failed` branch, so main only needs what the game uses.
- **Decision:** deleted `reanimator/`, `poltergeist/`, the committed `graphify-out/` cache and the three old workflows. Kept the project skeleton (moved to `game/`: package, Vite, TypeScript, ESLint and Vitest configs), the secrets guard and its workflow, the root env template (trimmed to LLM keys), `.claude/` skills and the licence. A new `Game CI` workflow provides the required `health` check.
- **Consequences:** pieces worth bringing back from `failed` when a task needs them: `reanimator/src/render/` (dot-matrix core), `reanimator/server/sse.ts` + `event-log.ts` (live streams), `reanimator/server/guard.ts` (loopback guard), `poltergeist/packages/core/src/compiler/llm.ts` (Groq/Ollama/Bedrock/Claude). The record-and-replay idea (`recorder.ts`, `shared/recording.ts`) is reused as a concept, not as code. The title still says "RE:Animator" until the team picks a name.

### D-03 to D-12: the PRD decisions
- **Context:** (2026-11-09) The team answered the questions blocking the PRD: hosting, Kiro, the terminal, the report, recordings, meters, minions, length and deadline.
- **Decision:** as in the table; the details are in `docs/PRD.md` §1 (platform), §6 (Kiro), SYS-09 (shell), SYS-11 + KIRO-06 (report), §9 (recording), SYS-05/06 (meters), §4 (minions), §3.1 (taunts).
- **Consequences:** GAME_PLAN §5.1's "LLM for taunts" and §6's "Kiro swats noise" are superseded (D-11, D-09). The game is no longer a static page: SYS-12 needs hosting (KI-04). Kiro credits are finite (KI-02).

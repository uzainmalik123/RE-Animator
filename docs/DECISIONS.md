# Decisions

| ID | Decision | Status |
|---|---|---|
| D-01 | Pivot: Reanimator and Poltergeist are scrapped; the entry is a horror cyber incident-response game (docs/GAME_PLAN.md) | Accepted |
| D-02 | Fresh start: main keeps only the game skeleton, the secrets guard and repo basics; everything else lives on the `failed` branch | Accepted |

### D-01: Pivot to an incident-response game
- **Context:** (2026-11-08) Reanimator raised dead repos so Death could attack them. Any agent can revive a repo on its own, so the product added nothing, and the UI had drifted into a pile of screens with no vision.
- **Decision:** the entry becomes a horror-themed incident-response simulator: a timed briefing, then Death attacks with real recorded attacks while the player defends with real actions; Death is driven by a rules-based Director; souls (data) and heartbeat (business) meters; three difficulty levels as dials on one scenario. Details and open questions are in `docs/GAME_PLAN.md`.
- **Consequences:** Poltergeist's engine isn't used. Kiro tokens are still saved for the demo.

### D-02: Fresh start on main
- **Context:** (2026-11-08) The old code is kept whole on the `failed` branch, so main only needs what the game uses.
- **Decision:** deleted `reanimator/`, `poltergeist/`, the committed `graphify-out/` cache and the three old workflows. Kept the project skeleton (moved to `game/`: package, Vite, TypeScript, ESLint and Vitest configs), the secrets guard and its workflow, the root env template (trimmed to LLM keys), `.claude/` skills and the licence. A new `Game CI` workflow provides the required `health` check.
- **Consequences:** pieces worth bringing back from `failed` when a task needs them: `reanimator/src/render/` (dot-matrix core), `reanimator/server/sse.ts` + `event-log.ts` (live streams), `reanimator/server/guard.ts` (loopback guard), `poltergeist/packages/core/src/compiler/llm.ts` (Groq/Ollama/Bedrock/Claude). The record-and-replay idea (`recorder.ts`, `shared/recording.ts`) is reused as a concept, not as code. The title still says "RE:Animator" until the team picks a name.

# AGENTS.md — read this first

This repository is the team's **Kiroween 2026** entry: a horror-themed **cyber incident-response game** (name still open). The plan is **`docs/GAME_PLAN.md`** (the why) and **`docs/PRD.md`** (exactly what gets built, the source of truth); read both before doing anything.

```
<repo root>/
  game/        the game: React + Vite + TypeScript (a black screen so far)
  docs/        GAME_PLAN.md (the why), PRD.md (the what), DECISIONS.md, KNOWN_ISSUES.md, KIRO_USAGE.md
  scripts/     the secrets guard (check-env-files.mjs)
  .github/     CI: `health` (game) and `env-files` (secrets guard), both required on main
  .kiro/       Kiro steering, specs and hooks (required by the rules; never gitignored)
  .claude/     repo-wide skills: grill-me / grilling
```

## History

The earlier project (Reanimator, which raised dead repos, and Poltergeist, a red-team engine) was scrapped on 2026-11-08 and is kept whole on the **`failed`** branch. Small, tested pieces of it (the dot-matrix renderer, SSE streaming, the loopback guard, LLM provider wiring) may be brought back when a task needs them; see `docs/DECISIONS.md` D-02. It's all our own code written inside the hacking window.

## Rules

- **Decide before building.** Build only what has a row in `docs/PRD.md`. To change or add one, edit the PRD and add a `docs/DECISIONS.md` entry first, then build; never improvise in code. Update a row's status in the PR that changes it. Reanimator failed by building features before deciding what the product was for.
- **One scenario, fully polished**, before a second exists.
- **The grill gate (D-14).** If a message asks to be grilled (or asks design questions to be settled) **and** to take all the recommended options in the same message, don't do it. Say: "No auto-accept on grilling: here are the questions, read them, then tell me to take the recommended ones or answer them yourself." Then ask the questions with recommendations and stop. Never answer your own grilling questions. This is how Reanimator went wrong.
- **Kiro use is judged (D-13).** Log every Kiro session in `docs/KIRO_USAGE.md`; the write-up claims only what's logged. Keep `/.kiro` at the root and never gitignore it.
- **Fresh code only.** Nothing is copied from `../reanimator` (the earlier prototype) or `../poltergeist-old`; both predate the hacking window (eligibility). The `failed` branch is fine: it was written inside the window.
- **`npm run health` stays green** in `game/` after every change. CI runs it.
- **No secrets in git.** Real keys go in the one `.env` at the repo root (gitignored; template `.env.example`). CI's `env-files` check blocks a PR that commits one, and `main`'s ruleset has no bypass for anyone.
- **Attacks only ever run against our own isolated, intentionally vulnerable app** (e.g. OWASP Juice Shop in Docker on our machine), and only while recording. Players never trigger a real attack; the game replays recordings.
- **Keep `docs/DECISIONS.md` and `docs/KNOWN_ISSUES.md` current** every session: add a decision when one is made, an issue when one is found.

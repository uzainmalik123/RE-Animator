# Kiroween 2026 entry (name to come)

> **You arrive expecting a horror game. You leave knowing how to respond to a real cyber emergency.**

A horror-themed **incident-response simulator**. You defend a company's web app while **Death** breaks in and keeps attacking, working from a dark ASCII security dashboard with **Kiro** as your assistant. Every attack in the game was really run against a deliberately vulnerable app in an isolated sandbox and recorded; the game replays those real recordings and Death adapts to every move you make.

**Status:** fresh start. The plan is in **[docs/GAME_PLAN.md](docs/GAME_PLAN.md)**. The game itself is a black screen so far.

The earlier project (Reanimator + Poltergeist) is kept on the [`failed`](../../tree/failed) branch.

## Run it

```sh
cd game
npm install
npm run dev      # http://localhost:5173
npm run health   # typecheck + lint + tests, what CI runs
```

## Licence

MIT
